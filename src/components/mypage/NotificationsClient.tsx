"use client";

import { useEffect, useState } from "react";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { Button } from "@/components/ui/Button";
import { MyPageListSkeleton } from "@/components/mypage/ui/MyPageSkeleton";
import { cn } from "@/lib/cn";

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
    return <MyPageListSkeleton rows={4} />;
  }

  if (items.length === 0) {
    return <MyPageEmptyState message="알림이 없습니다." dashed={false} />;
  }

  return (
    <div className="space-y-3">
      {items.map((notification) => (
        <MyPageCard
          key={notification.id}
          className={cn(
            !notification.is_read && "border-[var(--primary)]/30 bg-[var(--primary-soft)]/40",
          )}
        >
          <div className="flex min-h-[44px] items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{notification.title}</p>
              {notification.body ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{notification.body}</p>
              ) : null}
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {new Date(notification.created_at).toLocaleString("ko-KR")}
              </p>
            </div>
            {!notification.is_read ? (
              <Button type="button" variant="outline" size="sm" onClick={() => markRead(notification.id)}>
                읽음 처리
              </Button>
            ) : (
              <span className="type-caption text-[var(--text-muted)]">읽음</span>
            )}
          </div>
        </MyPageCard>
      ))}
    </div>
  );
}
