"use client";

import type { ReviewNotificationItem } from "@/types/reviewNotifications";
import { ReviewNotificationSeverityBadge } from "./ReviewNotificationSeverityBadge";
import { ReviewNotificationCategoryBadge } from "./ReviewNotificationCategoryBadge";
import { markNotificationAsRead, archiveNotification } from "@/app/admin/reviews/notifications/actions";
import { useTransition } from "react";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(0, 16);
  }
}

export function ReviewNotificationCard({
  item,
  onUpdate,
}: {
  item: ReviewNotificationItem;
  onUpdate?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isUnread = item.status === "unread";

  const handleMarkRead = () => {
    if (item.status !== "unread") return;
    startTransition(async () => {
      await markNotificationAsRead(item.id);
      onUpdate?.();
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      await archiveNotification(item.id);
      onUpdate?.();
    });
  };

  return (
    <article
      className={`rounded-xl border p-4 transition-colors ${
        isUnread ? "border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ReviewNotificationSeverityBadge severity={item.severity} />
        <ReviewNotificationCategoryBadge category={item.category} />
        <span className="text-xs text-[var(--text-muted)]">{formatDate(item.createdAt)}</span>
      </div>
      <h3 className="mt-2 font-medium text-[var(--text-primary)]">{item.title}</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{item.message}</p>
      {(item.productId || item.reviewId) && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {item.productId && <span>상품: {item.productId}</span>}
          {item.productId && item.reviewId && " · "}
          {item.reviewId && (
            <a
              href={`/admin/reviews?reviewId=${item.reviewId}`}
              className="text-[var(--link)] hover:underline"
            >
              리뷰: {item.reviewId.slice(0, 8)}…
            </a>
          )}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {isUnread && (
          <button
            type="button"
            onClick={handleMarkRead}
            disabled={pending}
            className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            읽음
          </button>
        )}
        <button
          type="button"
          onClick={handleArchive}
          disabled={pending}
          className="rounded-lg bg-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--text-muted)]/20 disabled:opacity-50"
        >
          보관
        </button>
      </div>
    </article>
  );
}
