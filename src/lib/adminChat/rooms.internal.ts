import "server-only";

import { AdminChatError } from "@/lib/adminChat/errors";
import type { AdminChatRoomRow } from "@/lib/adminChat/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function assertRoomMember(roomId: string, memberKey: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("admin_user_key", memberKey)
    .maybeSingle();

  if (error) throw new AdminChatError(error.message, 500);
  if (!data) throw new AdminChatError("이 채팅방에 접근할 수 없습니다.", 403);
}

export async function getRoom(roomId: string): Promise<AdminChatRoomRow> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw new AdminChatError(error.message, 500);
  if (!data) throw new AdminChatError("채팅방을 찾을 수 없습니다.", 404);
  return data as AdminChatRoomRow;
}

export async function getMemberKeys(roomId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_chat_room_members")
    .select("admin_user_key")
    .eq("room_id", roomId);

  if (error) throw new AdminChatError(error.message, 500);
  return (data ?? []).map((row) =>
    String((row as { admin_user_key: string }).admin_user_key),
  );
}

export async function touchRoomUpdatedAt(roomId: string): Promise<void> {
  await supabaseAdmin
    .from("admin_chat_rooms")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", roomId);
}
