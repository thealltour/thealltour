import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import { getAdminId, hasBootstrapAdminConfigured } from "@/lib/adminAuth";
import { listAdminUsers } from "@/lib/adminUsers";
import { AdminChatError } from "@/lib/adminChat/errors";
import { buildDirectKey, isValidAdminUserKey, toAdminUserKey } from "@/lib/adminChat/keys";
import {
  BOOTSTRAP_ROLE_LABEL,
  resolveParticipantProfile,
  resolveParticipants,
  rolePresetLabel,
} from "@/lib/adminChat/labels";
import { getMemberKeys } from "@/lib/adminChat/rooms.internal";
import {
  mapMessageRow,
  type AdminChatAdminOption,
  type AdminChatMessageRow,
  type AdminChatRoomRow,
  type AdminChatRoomSummary,
} from "@/lib/adminChat/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function listChatAdmins(): Promise<AdminChatAdminOption[]> {
  const options: AdminChatAdminOption[] = [];

  if (hasBootstrapAdminConfigured()) {
    const adminId = getAdminId() ?? "admin";
    options.push({
      key: `bootstrap:${adminId}`,
      displayName: adminId,
      roleLabel: BOOTSTRAP_ROLE_LABEL,
      username: adminId,
      isBootstrap: true,
    });
  }

  const users = await listAdminUsers();
  for (const user of users.filter((candidate) => candidate.is_active)) {
    options.push({
      key: `user:${user.id}`,
      displayName: user.display_name?.trim() || user.username,
      roleLabel: rolePresetLabel(user.role_preset),
      username: user.username,
      isBootstrap: false,
    });
  }

  return options;
}

async function buildRoomSummary(
  room: AdminChatRoomRow,
  memberKey: string,
  memberRow: { last_read_at: string | null },
): Promise<AdminChatRoomSummary> {
  const memberKeys = await getMemberKeys(room.id);
  const profiles = await resolveParticipants(memberKeys);
  const profileByKey = new Map(profiles.map((profile) => [profile.key, profile]));

  const { data: lastMsg } = await supabaseAdmin
    .from("admin_chat_messages")
    .select("*")
    .eq("room_id", room.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let unreadCount = 0;
  if (memberRow.last_read_at) {
    const { count } = await supabaseAdmin
      .from("admin_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .gt("created_at", memberRow.last_read_at);
    unreadCount = count ?? 0;
  } else {
    const { count } = await supabaseAdmin
      .from("admin_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    unreadCount = count ?? 0;
  }

  let name = room.name?.trim() || "그룹 채팅";
  let otherParticipant: AdminChatRoomSummary["otherParticipant"];

  if (room.type === "direct") {
    const otherKey = memberKeys.find((key) => key !== memberKey);
    if (otherKey) {
      const other = profileByKey.get(otherKey);
      if (other) {
        name = other.displayName;
        otherParticipant = {
          key: other.key,
          displayName: other.displayName,
          roleLabel: other.roleLabel,
        };
      }
    }
  }

  return {
    id: room.id,
    type: room.type,
    name,
    memberCount: memberKeys.length,
    otherParticipant,
    lastMessage: lastMsg ? mapMessageRow(lastMsg as AdminChatMessageRow) : undefined,
    unreadCount,
    updatedAt: room.updated_at,
  };
}

export async function listMyChatRooms(
  session: AdminSessionPayload,
): Promise<AdminChatRoomSummary[]> {
  const memberKey = toAdminUserKey(session);

  const { data: memberships, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("room_id,last_read_at")
    .eq("admin_user_key", memberKey)
    .order("joined_at", { ascending: false });

  if (error) throw new AdminChatError(error.message, 500);
  if (!memberships?.length) return [];

  const roomIds = memberships.map((membership) =>
    String((membership as { room_id: string }).room_id),
  );
  const { data: rooms, error: roomsError } = await supabaseAdmin
    .from("admin_chat_rooms")
    .select("*")
    .in("id", roomIds)
    .order("updated_at", { ascending: false });

  if (roomsError) throw new AdminChatError(roomsError.message, 500);

  const membershipByRoom = new Map(
    memberships.map((membership) => [
      String((membership as { room_id: string }).room_id),
      {
        last_read_at: (membership as { last_read_at: string | null }).last_read_at,
      },
    ]),
  );

  const summaries = await Promise.all(
    (rooms ?? []).map((room) =>
      buildRoomSummary(
        room as AdminChatRoomRow,
        memberKey,
        membershipByRoom.get(String(room.id)) ?? { last_read_at: null },
      ),
    ),
  );

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findOrCreateDirectRoom(
  session: AdminSessionPayload,
  targetKey: string,
): Promise<AdminChatRoomSummary> {
  if (!isValidAdminUserKey(targetKey)) {
    throw new AdminChatError("유효하지 않은 관리자 키입니다.");
  }

  const selfKey = toAdminUserKey(session);
  if (selfKey === targetKey) {
    throw new AdminChatError("자기 자신과는 1:1 채팅을 시작할 수 없습니다.");
  }

  const targetProfile = await resolveParticipantProfile(targetKey);
  if (!targetProfile) {
    throw new AdminChatError("대화 상대 관리자를 찾을 수 없습니다.", 404);
  }

  const directKey = buildDirectKey(selfKey, targetKey);
  const { data: existing } = await supabaseAdmin
    .from("admin_chat_rooms")
    .select("*")
    .eq("direct_key", directKey)
    .maybeSingle();

  if (existing) {
    const { data: membership } = await supabaseAdmin
      .from("admin_chat_room_members")
      .select("last_read_at")
      .eq("room_id", existing.id)
      .eq("admin_user_key", selfKey)
      .maybeSingle();

    return buildRoomSummary(existing as AdminChatRoomRow, selfKey, {
      last_read_at:
        (membership as { last_read_at: string | null } | null)?.last_read_at ?? null,
    });
  }

  const now = new Date().toISOString();
  const { data: room, error: roomError } = await supabaseAdmin
    .from("admin_chat_rooms")
    .insert({
      type: "direct",
      direct_key: directKey,
      created_by_key: selfKey,
      updated_at: now,
    })
    .select("*")
    .single();

  if (roomError || !room) {
    throw new AdminChatError(roomError?.message ?? "채팅방 생성 실패", 500);
  }

  const members = [
    { room_id: room.id, admin_user_key: selfKey, role: "owner" },
    { room_id: room.id, admin_user_key: targetKey, role: "member" },
  ];
  const { error: membersError } = await supabaseAdmin
    .from("admin_chat_room_members")
    .insert(members);
  if (membersError) throw new AdminChatError(membersError.message, 500);

  return buildRoomSummary(room as AdminChatRoomRow, selfKey, { last_read_at: null });
}

export async function createGroupRoom(
  session: AdminSessionPayload,
  name: string,
  memberKeys: string[],
): Promise<AdminChatRoomSummary> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new AdminChatError("그룹 이름을 입력하세요.");

  const selfKey = toAdminUserKey(session);
  const uniqueKeys = [
    ...new Set(
      memberKeys.filter((key) => key !== selfKey && isValidAdminUserKey(key)),
    ),
  ];

  if (uniqueKeys.length < 1) {
    throw new AdminChatError("그룹에 초대할 관리자를 1명 이상 선택하세요.");
  }

  for (const key of uniqueKeys) {
    const profile = await resolveParticipantProfile(key);
    if (!profile) throw new AdminChatError(`관리자를 찾을 수 없습니다: ${key}`, 404);
  }

  const now = new Date().toISOString();
  const { data: room, error } = await supabaseAdmin
    .from("admin_chat_rooms")
    .insert({
      type: "group",
      name: trimmedName,
      created_by_key: selfKey,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !room) {
    throw new AdminChatError(error?.message ?? "그룹 생성 실패", 500);
  }

  const members = [
    { room_id: room.id, admin_user_key: selfKey, role: "owner" },
    ...uniqueKeys.map((key) => ({
      room_id: room.id,
      admin_user_key: key,
      role: "member",
    })),
  ];
  const { error: membersError } = await supabaseAdmin
    .from("admin_chat_room_members")
    .insert(members);
  if (membersError) throw new AdminChatError(membersError.message, 500);

  return buildRoomSummary(room as AdminChatRoomRow, selfKey, { last_read_at: null });
}

export function getTotalUnreadCount(rooms: AdminChatRoomSummary[]): number {
  return rooms.reduce((sum, room) => sum + room.unreadCount, 0);
}

export { AdminChatError, adminChatErrorResponse } from "./errors";
export {
  listRoomMessages,
  sendRoomMessage,
  type SendRoomMessageInput,
} from "./messages";
export {
  inviteToGroupRoom,
  listRoomMembers,
  sendRoomTyping,
  markRoomRead,
  getRoomChannelName,
} from "./membership";
