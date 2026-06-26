"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { useAdminChat } from "@/components/admin/chat/AdminChatProvider";
import { deriveClientAdminUserKey } from "@/components/admin/chat/adminChat.utils";
import { useAdminChatInboxRealtime } from "@/hooks/useAdminChatInboxRealtime";

const REFRESH_DEBOUNCE_MS = 400;

/**
 * 방 목록·미읽음 배지를 백그라운드에서 동기화 (Realtime + 폴링 폴백).
 */
export default function AdminChatInboxSync() {
  const session = useAdminSession();
  const selfKey = deriveClientAdminUserKey(session);
  const { open, rooms, refreshRooms, activeRoomId } = useAdminChat();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refreshRooms();
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshRooms]);

  const roomIds = useMemo(() => {
    const ids = rooms.map((r) => r.id);
    if (open && activeRoomId) {
      return ids.filter((id) => id !== activeRoomId);
    }
    return ids;
  }, [rooms, open, activeRoomId]);

  useEffect(() => {
    if (!selfKey) return;
    void refreshRooms();
  }, [selfKey, refreshRooms]);

  useEffect(() => {
    if (open && selfKey) void refreshRooms();
  }, [open, selfKey, refreshRooms]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  useAdminChatInboxRealtime({
    roomIds,
    enabled: Boolean(selfKey),
    onActivity: scheduleRefresh,
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [scheduleRefresh]);

  return null;
}
