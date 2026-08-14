"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminNotificationsRealtime } from "@/hooks/useAdminNotificationsRealtime";
import { notificationTypeIcon } from "@/lib/adminNotificationTypes";
import { normalizeAdminConsoleHref } from "@/lib/adminConsolePaths";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  target_url: string | null;
  is_read: boolean;
  created_at: string | null;
};

type AdminNotificationBellProps = {
  initialUnreadCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export default function AdminNotificationBell({ initialUnreadCount }: AdminNotificationBellProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const { unreadCount: liveUnreadCount, refresh: refreshUnread } = useAdminNotificationsRealtime();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const latestNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  useEffect(() => {
    setUnreadCount((prev) => Math.max(prev, liveUnreadCount));
  }, [liveUnreadCount]);

  async function loadNotifications() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = (await response.json()) as {
        unreadCount?: number;
        notifications?: NotificationItem[];
        message?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.message ?? "알림을 불러오지 못했습니다.");
        return;
      }
      setUnreadCount(result.unreadCount ?? 0);
      setNotifications(result.notifications ?? []);
    } catch {
      setErrorMessage("알림 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.is_read) {
      try {
        await fetch(`/api/admin/notifications/${item.id}/read`, { method: "PATCH" });
      } catch {
        // Ignore read error; navigation still proceeds.
      }
      setNotifications((current) =>
        current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setIsOpen(false);
    router.refresh();
    router.push(normalizeAdminConsoleHref(item.target_url));
  }

  async function markAllAsRead() {
    setIsMarkingAll(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin/notifications/mark-all-read", { method: "PATCH" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "전체 읽음 처리에 실패했습니다.");
        return;
      }
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      router.refresh();
    } catch {
      setErrorMessage("전체 읽음 처리 중 오류가 발생했습니다.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) {
            void refreshUnread();
            void loadNotifications();
          }
        }}
        className="relative inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--surface-muted)]"
        title="관리자 알림"
        aria-label="관리자 알림"
      >
        🔔
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-modal)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0f172a]">알림</p>
            <button
              type="button"
              disabled={isMarkingAll || unreadCount === 0}
              onClick={markAllAsRead}
              className="text-xs font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)]"
            >
              {isMarkingAll ? "처리 중..." : "Mark all as read"}
            </button>
          </div>

          {errorMessage ? <p className="mb-2 text-xs text-red-500">{errorMessage}</p> : null}

          {isLoading ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">알림을 불러오는 중입니다...</p>
          ) : latestNotifications.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">새로운 알림이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {latestNotifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`w-full rounded-lg border p-2 text-left transition ${
                    item.is_read
                      ? "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-muted)]"
                      : "border-[color:color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[var(--success-bg)] hover:bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)]"
                  }`}
                >
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {notificationTypeIcon(item.type)}
                    {item.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.message}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{formatDate(item.created_at)}</p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-[var(--divider)] pt-2 text-right">
            <Link
              href="/theall_manager_only/notifications"
              className="text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
              onClick={() => setIsOpen(false)}
            >
              알림 전체보기 →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
