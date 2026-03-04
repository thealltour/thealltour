"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/notifications?limit=50", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    const res = await fetch(`/api/me/notifications/${id}/read`, { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--text-secondary)]">알림을 불러오는 중...</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">알림이 없습니다.</p>;
  }

  return (
    <section className="space-y-2">
      {items.map((notification) => (
        <article
          key={notification.id}
          className={`rounded-xl border p-4 ${
            notification.is_read
              ? "border-[var(--border)] bg-[var(--surface)]"
              : "border-[var(--primary)] bg-[var(--primary-soft)]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{notification.title}</p>
              {notification.body ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{notification.body}</p> : null}
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {new Date(notification.created_at).toLocaleString("ko-KR")}
              </p>
            </div>
            {!notification.is_read ? (
              <button
                type="button"
                onClick={() => markRead(notification.id)}
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)]"
              >
                읽음 처리
              </button>
            ) : (
              <span className="text-xs text-[var(--text-secondary)]">읽음</span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
