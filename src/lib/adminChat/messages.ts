import "server-only";

import type { AdminSessionPayload } from "@/lib/adminSession";
import { toAdminUserKey } from "@/lib/adminChat/keys";
import { resolveSenderProfile } from "@/lib/adminChat/labels";
import { broadcastChatMessage } from "@/lib/adminChat/realtime";
import {
  assertRoomMember,
  getMemberKeys,
  getRoom,
  touchRoomUpdatedAt,
} from "@/lib/adminChat/rooms.internal";
import {
  mapMessageRow,
  type AdminChatMessageDto,
  type AdminChatMessageRow,
  type AdminChatRoomRow,
} from "@/lib/adminChat/types";
import { AdminChatError } from "@/lib/adminChat/errors";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { dispatchAdminWebPushToUserKeys } from "@/lib/adminWebPush";

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export async function listRoomMessages(
  session: AdminSessionPayload,
  roomId: string,
  options?: { before?: string; limit?: number },
): Promise<{ messages: AdminChatMessageDto[]; peerLastReadAt?: string | null }> {
  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const room = await getRoom(roomId);
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

  let peerLastReadAt: string | null | undefined;
  if (room.type === "direct") {
    const memberKeys = await getMemberKeys(roomId);
    const peerKey = memberKeys.find((key) => key !== selfKey);
    if (peerKey) {
      const { data: peerMember } = await supabaseAdmin
        .from("admin_chat_room_members")
        .select("last_read_at")
        .eq("room_id", roomId)
        .eq("admin_user_key", peerKey)
        .maybeSingle();
      peerLastReadAt =
        (peerMember as { last_read_at: string | null } | null)?.last_read_at ?? null;
    }
  }

  return { messages, peerLastReadAt };
}

export type SendRoomMessageInput = {
  body?: string;
  attachmentUrls?: string[];
};

function resolveMessageType(body: string, attachmentUrls: string[]): "text" | "image" | "mixed" {
  if (attachmentUrls.length > 0 && body) return "mixed";
  if (attachmentUrls.length > 0) return "image";
  return "text";
}

async function notifyChatMessagePush(
  roomId: string,
  room: AdminChatRoomRow,
  senderKey: string,
  senderDisplayName: string,
  preview: string,
): Promise<void> {
  const memberKeys = await getMemberKeys(roomId);
  const recipientKeys = memberKeys.filter((key) => key !== senderKey);
  if (recipientKeys.length === 0) return;

  const roomLabel = room.type === "group" && room.name ? room.name : senderDisplayName;
  void dispatchAdminWebPushToUserKeys(
    recipientKeys,
    {
      title: `팀 채팅 · ${roomLabel}`,
      body: preview,
      targetUrl: `/theall_manager_only?chatRoom=${roomId}`,
      type: "admin_chat_message",
    },
    { chatOnly: true },
  ).catch(() => {
    // 푸시 실패해도 메시지 전송은 유지
  });
}

export async function sendRoomMessage(
  session: AdminSessionPayload,
  roomId: string,
  input: string | SendRoomMessageInput,
): Promise<AdminChatMessageDto> {
  const normalized =
    typeof input === "string"
      ? { body: input, attachmentUrls: [] as string[] }
      : { body: input.body ?? "", attachmentUrls: input.attachmentUrls ?? [] };

  const trimmed = normalized.body.trim();
  const attachmentUrls = normalized.attachmentUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, 8);

  if (!trimmed && attachmentUrls.length === 0) {
    throw new AdminChatError("메시지 또는 이미지를 입력하세요.");
  }

  const selfKey = toAdminUserKey(session);
  await assertRoomMember(roomId, selfKey);

  const room = await getRoom(roomId);
  const sender = await resolveSenderProfile(session);
  const now = new Date().toISOString();
  const messageType = resolveMessageType(trimmed, attachmentUrls);

  const { data, error } = await supabaseAdmin
    .from("admin_chat_messages")
    .insert({
      room_id: roomId,
      sender_key: selfKey,
      sender_display_name: sender.displayName,
      sender_role_label: sender.roleLabel,
      body: trimmed,
      message_type: messageType,
      attachment_urls: attachmentUrls,
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AdminChatError(error?.message ?? "메시지 전송 실패", 500);
  }

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
      messageType: message.messageType,
      attachmentUrls: message.attachmentUrls,
      createdAt: message.createdAt,
    });
  } catch {
    // Broadcast 실패해도 메시지는 저장됨 — 폴링으로 수신 가능
  }

  const preview = trimmed || (attachmentUrls.length > 0 ? "사진을 보냈습니다." : "");
  void notifyChatMessagePush(roomId, room, selfKey, sender.displayName, preview);

  return message;
}
