"use client";

import { useRouter } from "next/navigation";
import type { ReviewNotificationItem, ReviewNotificationSummary } from "@/types/reviewNotifications";
import { ReviewNotificationSummaryCards } from "./ReviewNotificationSummaryCards";
import { ReviewNotificationList } from "./ReviewNotificationList";
import { markAllNotificationsAsRead, runReviewNotificationPipeline } from "@/app/admin/reviews/notifications/actions";
import { useTransition } from "react";

export function ReviewNotificationsDashboard({
  notifications,
  summary,
}: {
  notifications: ReviewNotificationItem[];
  summary: ReviewNotificationSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleRefresh = () => router.refresh();

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsAsRead();
      handleRefresh();
    });
  };

  const handleRunPipeline = () => {
    startTransition(async () => {
      await runReviewNotificationPipeline();
      handleRefresh();
    });
  };

  return (
    <div className="space-y-6">
      <ReviewNotificationSummaryCards summary={summary} />

      <div className="flex flex-wrap items-center gap-3">
        {summary.unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={pending}
            className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            전체 읽음 처리
          </button>
        )}
        <button
          type="button"
          onClick={handleRunPipeline}
          disabled={pending}
          className="rounded-lg bg-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--text-muted)]/20 disabled:opacity-50"
        >
          알림 새로 생성
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">최근 알림</h2>
        <ReviewNotificationList notifications={notifications} onUpdate={handleRefresh} />
      </section>
    </div>
  );
}
