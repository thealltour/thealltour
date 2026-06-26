import "server-only";

import { createHmac } from "crypto";
import {
  ADMIN_CHAT_BROADCAST_EVENT,
  ADMIN_CHAT_TYPING_EVENT,
} from "@/lib/adminChat/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function resolveRealtimeSecret(): string {
  const dedicated = process.env.ADMIN_CHAT_REALTIME_SECRET?.trim();
  if (dedicated) return dedicated;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (sessionSecret) return sessionSecret;
  if (process.env.NODE_ENV !== "production") {
    return "__THEALL_LOCAL_DEV_ONLY_ADMIN_CHAT_REALTIME_SECRET__";
  }
  throw new Error("ADMIN_CHAT_REALTIME_SECRET 또는 ADMIN_SESSION_SECRET이 필요합니다.");
}

export function buildChatChannelName(roomId: string): string {
  const hmac = createHmac("sha256", resolveRealtimeSecret())
    .update(roomId)
    .digest("hex")
    .slice(0, 16);
  return `admin-chat:${roomId}:${hmac}`;
}

export type ChatBroadcastPayload = {
  id: string;
  roomId: string;
  senderKey: string;
  senderDisplayName: string;
  senderRoleLabel: string;
  body: string;
  messageType?: "text" | "image" | "mixed";
  attachmentUrls?: string[];
  createdAt: string;
};

export type ChatTypingBroadcastPayload = {
  roomId: string;
  senderKey: string;
  senderDisplayName: string;
  typing: boolean;
};

async function broadcastOnRoomChannel(
  roomId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const channelName = buildChatChannelName(roomId);
  const channel = supabaseAdmin.channel(channelName);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void supabaseAdmin.removeChannel(channel);
      reject(new Error("Realtime broadcast subscribe timeout"));
    }, 8_000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel
          .send({
            type: "broadcast",
            event,
            payload,
          })
          .then((sendStatus) => {
            clearTimeout(timeout);
            void supabaseAdmin.removeChannel(channel);
            if (sendStatus === "ok") resolve();
            else reject(new Error(`Realtime broadcast send: ${sendStatus}`));
          })
          .catch((err) => {
            clearTimeout(timeout);
            void supabaseAdmin.removeChannel(channel);
            reject(err);
          });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        void supabaseAdmin.removeChannel(channel);
        reject(new Error(`Realtime channel status: ${status}`));
      }
    });
  });
}

export async function broadcastChatMessage(
  roomId: string,
  payload: ChatBroadcastPayload,
): Promise<void> {
  await broadcastOnRoomChannel(roomId, ADMIN_CHAT_BROADCAST_EVENT, payload);
}

export async function broadcastChatTyping(
  roomId: string,
  payload: ChatTypingBroadcastPayload,
): Promise<void> {
  await broadcastOnRoomChannel(roomId, ADMIN_CHAT_TYPING_EVENT, payload);
}

export { ADMIN_CHAT_BROADCAST_EVENT, ADMIN_CHAT_TYPING_EVENT } from "@/lib/adminChat/constants";
