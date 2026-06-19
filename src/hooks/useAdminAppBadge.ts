"use client";

import { useCallback, useEffect } from "react";
import { syncAdminAppBadge } from "@/lib/adminPwaClient";
import { supabase } from "@/lib/supabase";
import { isAdminConsolePublicPath } from "@/lib/adminConsolePaths";
import { usePathname } from "next/navigation";

const POLL_MS = 30_000;

/** OS 홈 화면 아이콘 배지 — 관리자 로그인 영역 전역 1회 동기화 */
export function useAdminAppBadgeSync() {
  const pathname = usePathname();

  const syncBadge = useCallback(async () => {
    if (isAdminConsolePublicPath(pathname)) return;
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      const data = (await res.json()) as { unreadCount?: number };
      if (res.ok) await syncAdminAppBadge(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, [pathname]);

  useEffect(() => {
    if (isAdminConsolePublicPath(pathname)) return;

    void syncBadge();

    const channel = supabase
      .channel("admin-app-badge-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        () => {
          void syncBadge();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        () => {
          void syncBadge();
        },
      )
      .subscribe();

    const pollId = setInterval(() => {
      void syncBadge();
    }, POLL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void syncBadge();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollId);
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, syncBadge]);
}

/** @deprecated useAdminAppBadgeSync 사용 */
export function useAdminAppBadge(unreadCount: number) {
  useEffect(() => {
    void syncAdminAppBadge(unreadCount);
  }, [unreadCount]);
}
