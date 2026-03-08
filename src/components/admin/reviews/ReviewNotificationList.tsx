"use client";

import type { ReviewNotificationItem } from "@/types/reviewNotifications";
import { SEVERITY_ORDER } from "@/lib/reviewNotificationConstants";
import { ReviewNotificationCard } from "./ReviewNotificationCard";

function sortNotifications(items: ReviewNotificationItem[]): ReviewNotificationItem[] {
  return [...items].sort((a, b) => {
    const unreadA = a.status === "unread" ? 1 : 0;
    const unreadB = b.status === "unread" ? 1 : 0;
    if (unreadB !== unreadA) return unreadB - unreadA;
    const sevA = SEVERITY_ORDER[a.severity] ?? 99;
    const sevB = SEVERITY_ORDER[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function ReviewNotificationList({
  notifications,
  onUpdate,
}: {
  notifications: ReviewNotificationItem[];
  onUpdate?: () => void;
}) {
  const sorted = sortNotifications(notifications);
  if (sorted.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
        현재 생성된 리뷰 운영 알림이 없습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {sorted.map((item) => (
        <li key={item.id}>
          <ReviewNotificationCard item={item} onUpdate={onUpdate} />
        </li>
      ))}
    </ul>
  );
}
