"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  target_url: string | null;
  is_read: boolean;
  created_at: string | null;
};

const NOTIFICATION_FILTER_TABS = [
  { id: "all", label: "전체" },
  { id: "birthday_upcoming", label: "생일" },
  { id: "new_member", label: "신규회원" },
  { id: "new_review", label: "신규후기" },
  { id: "new_inquiry", label: "신규상담" },
] as const;

type NotificationFilterTabId = (typeof NOTIFICATION_FILTER_TABS)[number]["id"];

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

export default function AdminNotificationList() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<NotificationFilterTabId>("all");

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
        setErrorMessage(result.message ?? "알림 목록 조회에 실패했습니다.");
        return;
      }

      setUnreadCount(result.unreadCount ?? 0);
      setNotifications(result.notifications ?? []);
    } catch {
      setErrorMessage("알림 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

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

  async function openNotification(item: NotificationItem) {
    setErrorMessage("");
    if (!item.is_read) {
      try {
        await fetch(`/api/admin/notifications/${item.id}/read`, { method: "PATCH" });
      } catch {
        // Ignore read failures on navigation.
      }
    }

    setNotifications((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
    );
    setUnreadCount((prev) => Math.max(0, prev - (item.is_read ? 0 : 1)));
    router.refresh();
    if (item.target_url) {
      router.push(item.target_url);
    }
  }

  if (isLoading) {
    return <p className="px-4 py-6 text-sm text-slate-500">알림 목록을 불러오는 중입니다...</p>;
  }

  const filteredNotifications =
    activeTab === "all" ? notifications : notifications.filter((item) => item.type === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <p className="text-sm text-slate-600">
          읽지 않은 알림 <span className="font-semibold text-[#1d4ed8]">{unreadCount}</span>건
        </p>
        <button
          type="button"
          disabled={isMarkingAll || unreadCount === 0}
          onClick={markAllAsRead}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMarkingAll ? "처리 중..." : "Mark all as read"}
        </button>
      </div>

      {errorMessage ? <p className="px-4 text-sm text-red-500">{errorMessage}</p> : null}

      <div className="flex flex-wrap gap-2 px-4">
        {NOTIFICATION_FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === tab.id
                ? "bg-[#2563eb] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            선택한 조건의 알림이 없습니다.
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.is_read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#0f172a]">
                    {item.type === "birthday_upcoming"
                      ? "🎂 "
                      : item.type === "new_member"
                        ? "👤 "
                        : item.type === "new_review"
                          ? "📝 "
                          : item.type === "new_inquiry"
                            ? "📞 "
                            : "🔔 "}
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-700">{item.message}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.is_read
                        ? "bg-slate-100 text-slate-500"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.is_read ? "읽음" : "새 알림"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    {item.target_url ? "열기" : "확인"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
