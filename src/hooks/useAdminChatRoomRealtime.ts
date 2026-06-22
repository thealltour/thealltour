"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ADMIN_CHAT_BROADCAST_EVENT } from "@/lib/adminChat/constants";
import type { AdminChatMessageDto } from "@/lib/adminChat/types";

const POLL_MS = 3_000;

type UseAdminChatRoomRealtimeOptions = {
  roomId: string | null;
  enabled?: boolean;
  onMessage: (message: AdminChatMessageDto) => void;
  onPoll?: () => void;
};

export function useAdminChatRoomRealtime({
  roomId,
  enabled = true,
  onMessage,
  onPoll,
}: UseAdminChatRoomRealtimeOptions) {
  const onMessageRef = useRef(onMessage);
  const onPollRef = useRef(onPoll);
  onMessageRef.current = onMessage;
  onPollRef.current = onPoll;

  const fetchChannelName = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/chat/rooms/${id}/channel`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { channelName?: string };
    return data.channelName ?? null;
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) return;

    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const channelName = await fetchChannelName(roomId);
      if (cancelled || !channelName) return;

      const channel = supabase
        .channel(channelName)
        .on("broadcast", { event: ADMIN_CHAT_BROADCAST_EVENT }, (payload) => {
          const msg = payload.payload as AdminChatMessageDto | undefined;
          if (msg?.id && msg.roomId === roomId) {
            onMessageRef.current(msg);
          }
        })
        .subscribe();

      channelRef = channel;
    };

    void setup();

    const pollId = setInterval(() => {
      onPollRef.current?.();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      if (channelRef) void supabase.removeChannel(channelRef);
    };
  }, [enabled, roomId, fetchChannelName]);
}
