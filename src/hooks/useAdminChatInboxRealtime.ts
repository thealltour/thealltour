"use client";

import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ADMIN_CHAT_BROADCAST_EVENT } from "@/lib/adminChat/constants";

const FALLBACK_POLL_MS = 30_000;

type UseAdminChatInboxRealtimeOptions = {
  roomIds: string[];
  enabled?: boolean;
  onActivity: () => void;
};

async function fetchChannelName(roomId: string): Promise<string | null> {
  const res = await fetch(`/api/admin/chat/rooms/${roomId}/channel`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { channelName?: string };
  return data.channelName ?? null;
}

/**
 * 내가 속한 모든 채팅방 Broadcast를 구독해 패널이 닫혀 있어도 미읽음 배지를 갱신합니다.
 */
export function useAdminChatInboxRealtime({
  roomIds,
  enabled = true,
  onActivity,
}: UseAdminChatInboxRealtimeOptions) {
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const roomIdsKey = useMemo(() => [...roomIds].sort().join("\0"), [roomIds]);

  useEffect(() => {
    if (!enabled || roomIds.length === 0) return;

    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const setup = async () => {
      const names = await Promise.all(
        roomIds.map(async (roomId) => {
          const channelName = await fetchChannelName(roomId);
          return channelName ? { roomId, channelName } : null;
        }),
      );

      if (cancelled) return;

      for (const entry of names) {
        if (!entry || cancelled) continue;

        const channel = supabase
          .channel(entry.channelName)
          .on("broadcast", { event: ADMIN_CHAT_BROADCAST_EVENT }, () => {
            onActivityRef.current();
          })
          .subscribe();

        channels.push(channel);
      }
    };

    void setup();

    const pollId = setInterval(() => {
      onActivityRef.current();
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, roomIdsKey, roomIds.length]);
}
