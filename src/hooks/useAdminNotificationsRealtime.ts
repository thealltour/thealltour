"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const POLL_MS = 30_000;

export function useAdminNotificationsRealtime() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      const data = (await res.json()) as { unreadCount?: number };
      if (res.ok) setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    pollRef.current = setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
