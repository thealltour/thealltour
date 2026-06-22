import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import { getAdminId, hasBootstrapAdminConfigured } from "@/lib/adminAuth";
import { listAdminUsers } from "@/lib/adminUsers";
import { buildDirectKey, isValidAdminUserKey, toAdminUserKey } from "@/lib/adminChat/keys";
import {
  BOOTSTRAP_ROLE_LABEL,
  resolveParticipantProfile,
  resolveParticipants,
  resolveSenderProfile,
  rolePresetLabel,
} from "@/lib/adminChat/labels";
import { broadcastChatMessage } from "@/lib/adminChat/realtime";
import {
  mapMessageRow,
  type AdminChatAdminOption,
  type AdminChatMessageDto,
  type AdminChatMessageRow,
  type AdminChatRoomRow,
  type AdminChatRoomSummary,
} from "@/lib/adminChat/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export class AdminChatError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AdminChatError";
  }
}

async function assertRoomMember(roomId: string, memberKey: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("admin_user_key", memberKey)
    .maybeSingle();

  if (error) throw new AdminChatError(error.message, 500);
  if (!data) throw new AdminChatError("이 채팅방에 접근할 수 없습니다.", 403);
}

async function getRoom(roomId: string): Promise<AdminChatRoomRow> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw new AdminChatError(error.message, 500);
  if (!data) throw new AdminChatError("채팅방을 찾을 수 없습니다.", 404);
  return data as AdminChatRoomRow;
}

async function getMemberKeys(roomId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("admin_user_key")
    .eq("room_id", roomId);

  if (error) throw new AdminChatError(error.message, 500);
  return (data ?? []).map((r) => String((r as { admin_user_key: string }).admin_user_key));
}

async function touchRoomUpdatedAt(roomId: string): Promise<void> {
  await supabaseAdmin
    .from("admin_chat_rooms")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", roomId);
}

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
  for (const user of users.filter((u) => u.is_active)) {
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
  const profileByKey = new Map(profiles.map((p) => [p.key, p]));

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
    const otherKey = memberKeys.find((k) => k !== memberKey);
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

export async function listMyChatRooms(session: AdminSessionPayload): Promise<AdminChatRoomSummary[]> {
  const memberKey = toAdminUserKey(session);

  const { data: memberships, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("room_id,last_read_at")
    .eq("admin_user_key", memberKey)
    .order("joined_at", { ascending: false });

  if (error) throw new AdminChatError(error.message, 500);
  if (!memberships?.length) return [];

  const roomIds = memberships.map((m) => String((m as { room_id: string }).room_id));
  const { data: rooms, error: roomsError } = await supabaseAdmin
    .from("admin_chat_rooms")
    .select("*")
    .in("id", roomIds)
    .order("updated_at", { ascending: false });

  if (roomsError) throw new AdminChatError(roomsError.message, 500);

  const membershipByRoom = new Map(
    memberships.map((m) => [
      String((m as { room_id: string }).room_id),
      { last_read_at: (m as { last_read_at: string | null }).last_read_at },
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
    const memberKey = selfKey;
    const { data: membership } = await supabaseAdmin
      .from("admin_chat_room_members")
      .select("last_read_at")
      .eq("room_id", existing.id)
      .eq("admin_user_key", memberKey)
      .maybeSingle();

    return buildRoomSummary(
      existing as AdminChatRoomRow,
      memberKey,
      { last_read_at: (membership as { last_read_at: string | null } | null)?.last_read_at ?? null },
    );
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

  if (roomError || !room) throw new AdminChatError(roomError?.message ?? "채팅방 생성 실패", 500);

  const members = [
    { room_id: room.id, admin_user_key: selfKey, role: "owner" },
    { room_id: room.id, admin_user_key: targetKey, role: "member" },
  ];

  const { error: membersError } = await supabaseAdmin.from("admin_chat_room_members").insert(members);
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
  const uniqueKeys = [...new Set(memberKeys.filter((k) => k !== selfKey && isValidAdminUserKey(k)))];

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

  if (error || !room) throw new AdminChatError(error?.message ?? "그룹 생성 실패", 500);

  const members = [
    { room_id: room.id, admin_user_key: selfKey, role: "owner" },
    ...uniqueKeys.map((k) => ({ room_id: room.id, admin_user_key: k, role: "member" })),
  ];

  const { error: membersError } = await supabaseAdmin.from("admin_chat_room_members").insert(members);
  if (membersError) throw new AdminChatError(membersError.message, 500);

  return buildRoomSummary(room as AdminChatRoomRow, selfKey, { last_read_at: null });
}

export async function inviteToGroupRoom(
  session: AdminSessionPayload,
  roomId: string,
  memberKeys: string[],
): Promise<{ added: string[] }> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const room = await getRoom(roomId);
  if (room.type !== "group") {
    throw new AdminChatError("그룹 채팅방에서만 초대할 수 있습니다.");
  }

  const { data: selfMember } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("admin_user_key", selfKey)
    .maybeSingle();

  const isOwner = (selfMember as { role: string } | null)?.role === "owner";
  if (!isOwner && !session.isBootstrapAdmin) {
    throw new AdminChatError("방장 또는 총괄 관리자만 초대할 수 있습니다.", 403);
  }

  const existingKeys = new Set(await getMemberKeys(roomId));
  const toAdd = [...new Set(memberKeys.filter((k) => isValidAdminUserKey(k) && !existingKeys.has(k)))];

  if (!toAdd.length) return { added: [] };

  for (const key of toAdd) {
    const profile = await resolveParticipantProfile(key);
    if (!profile) throw new AdminChatError(`관리자를 찾을 수 없습니다: ${key}`, 404);
  }

  const rows = toAdd.map((k) => ({
    room_id: roomId,
    admin_user_key: k,
    role: "member",
  }));

  const { error } = await supabaseAdmin.from("admin_chat_room_members").insert(rows);
  if (error) throw new AdminChatError(error.message, 500);

  await touchRoomUpdatedAt(roomId);
  return { added: toAdd };
}

export async function listRoomMembers(roomId: string, session: AdminSessionPayload) {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const keys = await getMemberKeys(roomId);
  const profiles = await resolveParticipants(keys);

  const { data: memberRows } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("admin_user_key,role,joined_at")
    .eq("room_id", roomId);

  const roleByKey = new Map(
    (memberRows ?? []).map((r) => [
      String((r as { admin_user_key: string }).admin_user_key),
      {
        role: (r as { role: string }).role,
        joinedAt: (r as { joined_at: string }).joined_at,
      },
    ]),
  );

  return profiles.map((p) => ({
    ...p,
    memberRole: roleByKey.get(p.key)?.role ?? "member",
    joinedAt: roleByKey.get(p.key)?.joinedAt ?? null,
  }));
}

export async function listRoomMessages(
  session: AdminSessionPayload,
  roomId: string,
  options?: { before?: string; limit?: number },
): Promise<{ messages: AdminChatMessageDto[] }> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_MESSAGE_LIMIT, 1), MAX_MESSAGE_LIMIT);

  let query = supabaseAdmin
    .from("admin_chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw new AdminChatError(error.message, 500);

  const messages = (data ?? [])
    .map((row) => mapMessageRow(row as AdminChatMessageRow))
    .reverse();

  return { messages };
}

export async function sendRoomMessage(
  session: AdminSessionPayload,
  roomId: string,
  body: string,
): Promise<AdminChatMessageDto> {
  const trimmed = body.trim();
  if (!trimmed) throw new AdminChatError("메시지를 입력하세요.");

  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const sender = await resolveSenderProfile(session);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("admin_chat_messages")
    .insert({
      room_id: roomId,
      sender_key: selfKey,
      sender_display_name: sender.displayName,
      sender_role_label: sender.roleLabel,
      body: trimmed,
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) throw new AdminChatError(error?.message ?? "메시지 전송 실패", 500);

  await supabaseAdmin
    .from("admin_chat_room_members")
    .update({ last_read_at: now })
    .eq("room_id", roomId)
    .eq("admin_user_key", selfKey);

  await touchRoomUpdatedAt(roomId);

  const message = mapMessageRow(data as AdminChatMessageRow);

  try {
    await broadcastChatMessage(roomId, {
      id: message.id,
      roomId: message.roomId,
      senderKey: message.senderKey,
      senderDisplayName: message.senderDisplayName,
      senderRoleLabel: message.senderRoleLabel,
      body: message.body,
      createdAt: message.createdAt,
    });
  } catch {
    // Broadcast 실패해도 메시지는 저장됨 — 폴링으로 수신 가능
  }

  return message;
}

export async function markRoomRead(session: AdminSessionPayload, roomId: string): Promise<void> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .update({ last_read_at: now })
    .eq("room_id", roomId)
    .eq("admin_user_key", selfKey);

  if (error) throw new AdminChatError(error.message, 500);
}

export async function getRoomChannelName(
  session: AdminSessionPayload,
  roomId: string,
): Promise<string> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);
  const { buildChatChannelName } = await import("@/lib/adminChat/realtime");
  return buildChatChannelName(roomId);
}

export function getTotalUnreadCount(rooms: AdminChatRoomSummary[]): number {
  return rooms.reduce((sum, r) => sum + r.unreadCount, 0);
}
