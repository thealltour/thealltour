import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import { AdminChatError } from "@/lib/adminChat/errors";
import { isValidAdminUserKey, toAdminUserKey } from "@/lib/adminChat/keys";
import {
  resolveParticipantProfile,
  resolveParticipants,
  resolveSenderProfile,
} from "@/lib/adminChat/labels";
import { broadcastChatTyping } from "@/lib/adminChat/realtime";
import {
  assertRoomMember,
  getMemberKeys,
  getRoom,
  touchRoomUpdatedAt,
} from "@/lib/adminChat/rooms.internal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export { assertRoomMember } from "@/lib/adminChat/rooms.internal";

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
  const toAdd = [
    ...new Set(memberKeys.filter((key) => isValidAdminUserKey(key) && !existingKeys.has(key))),
  ];

  if (!toAdd.length) return { added: [] };

  for (const key of toAdd) {
    const profile = await resolveParticipantProfile(key);
    if (!profile) throw new AdminChatError(`관리자를 찾을 수 없습니다: ${key}`, 404);
  }

  const rows = toAdd.map((key) => ({
    room_id: roomId,
    admin_user_key: key,
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
    (memberRows ?? []).map((row) => [
      String((row as { admin_user_key: string }).admin_user_key),
      {
        role: (row as { role: string }).role,
        joinedAt: (row as { joined_at: string }).joined_at,
      },
    ]),
  );

  return profiles.map((profile) => ({
    ...profile,
    memberRole: roleByKey.get(profile.key)?.role ?? "member",
    joinedAt: roleByKey.get(profile.key)?.joinedAt ?? null,
  }));
}

export async function sendRoomTyping(
  session: AdminSessionPayload,
  roomId: string,
  typing: boolean,
): Promise<void> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);
  const sender = await resolveSenderProfile(session);

  try {
    await broadcastChatTyping(roomId, {
      roomId,
      senderKey: selfKey,
      senderDisplayName: sender.displayName,
      typing,
    });
  } catch {
    // typing 신호 실패는 무시
  }
}

export async function markRoomRead(
  session: AdminSessionPayload,
  roomId: string,
): Promise<void> {
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
