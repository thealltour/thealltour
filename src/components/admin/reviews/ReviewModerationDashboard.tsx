"use client";

/**
 * 데스크톱 전용 리뷰 검토 대시보드(요약·큐 테이블·배치 액션·이력).
 * 모바일은 MobileReviewModerationSection 을 사용합니다.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ModerationReviewCard } from "./ModerationReviewCard";
import { ModerationSummaryCards } from "./ModerationSummaryCards";
import { ModerationQueueTable } from "./ModerationQueueTable";
import { ModerationBatchActionBar } from "./ModerationBatchActionBar";
import { ReviewReportReasonBadgeList } from "./ReviewReportReasonBadgeList";
import { ReviewModerationHistoryList } from "./ReviewModerationHistoryList";
import { fromDbStatus } from "@/types/reviewModeration";
import type { ReviewModerationStatus } from "@/types/reviewModeration";
import type { ReviewModerationQueueItem } from "@/lib/reviewModerationQueue";
import type { ReviewReportSummary } from "@/types/reviewReports";
import type { ReviewModerationHistoryItem } from "@/types/reviewModerationHistory";

type ModerationReview = {
  id: string;
  product_id: string | null;
  title: string;
  content: string;
  author_name: string;
  created_at: string | null;
  rating: number | null;
  status: string;
  report_count: number;
  last_moderated_at: string | null;
  moderation_reason: string | null;
  eligibility_id: string | null;
  image_url: string | null;
  image_urls: string[] | null;
};

type Summary = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
  recentReportsCount: number;
};

export type ReviewModerationDashboardProps = {
  reviews: ModerationReview[];
  queueItems: ReviewModerationQueueItem[];
  reportSummaries: Record<string, ReviewReportSummary>;
  summary: Summary;
  moderationHistoryByReview?: Record<string, ReviewModerationHistoryItem[]>;
  authorProfileByReviewId?: Record<
    string,
    { authorRiskLevel: "low" | "medium" | "high"; authorTrustScore: number; authorReviewCount: number }
  >;
};

function filterByStatus(reviews: ModerationReview[], status: ReviewModerationStatus) {
  return reviews.filter((r) => fromDbStatus(r.status) === status);
}

/** 전체 신고 사유 집계 (Report Reason Breakdown용) */
function aggregateReasons(summaries: Record<string, ReviewReportSummary>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const s of Object.values(summaries)) {
    for (const [reason, count] of Object.entries(s.reasons)) {
      acc[reason] = (acc[reason] ?? 0) + count;
    }
  }
  return acc;
}

export function ReviewModerationDashboard({
  reviews,
  queueItems,
  reportSummaries,
  summary,
  moderationHistoryByReview = {},
  authorProfileByReviewId = {},
}: ReviewModerationDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (searchParams.get("filter") !== "flagged") return;
    const timer = window.setTimeout(() => {
      document.getElementById("moderation-flagged")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const handleBatchAction = async (action: string, ids: string[]) => {
    const res = await fetch("/api/admin/reviews/batch-moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewIds: ids }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? "일괄 처리에 실패했습니다.");
    }
    const data = await res.json();
    return { successIds: data.successIds ?? [], failedIds: data.failedIds ?? [] };
  };

  const handleDone = () => router.refresh();

  const flagged = reviews.filter((r) => r.report_count > 0 || fromDbStatus(r.status) === "flagged");
  const underReview = filterByStatus(reviews, "under_review").filter((r) => !flagged.find((f) => f.id === r.id));
  const hidden = filterByStatus(reviews, "hidden");
  const aggregatedReasons = aggregateReasons(reportSummaries);
  const reasonsForBadge =
    Object.keys(aggregatedReasons).length > 0
      ? (aggregatedReasons as Record<import("@/types/reviewReports").ReviewReportReason, number>)
      : ({} as Record<import("@/types/reviewReports").ReviewReportReason, number>);

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          현재 검토가 필요한 리뷰가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ModerationSummaryCards
        pendingCount={summary.pendingCount}
        highPriorityCount={summary.highPriorityCount}
        flaggedCount={summary.flaggedCount}
        hiddenCount={summary.hiddenCount}
        recentReportsCount={summary.recentReportsCount}
      />

      {selectedIds.size > 0 && (
        <ModerationBatchActionBar
          selectedIds={[...selectedIds]}
          onClearSelection={() => setSelectedIds(new Set())}
          onBatchAction={handleBatchAction}
          onActionDone={handleDone}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Priority Queue</h2>
        <ModerationQueueTable
          items={queueItems}
          onActionDone={handleDone}
          selectedIds={[...selectedIds]}
          onSelectionChange={(ids) => setSelectedIds(new Set(ids))}
        />
      </section>

      {Object.keys(reasonsForBadge).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Report Reason Breakdown</h2>
          <ReviewReportReasonBadgeList reasons={reasonsForBadge} />
        </section>
      )}

      {flagged.length > 0 && (
        <section id="moderation-flagged">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">신고된 리뷰</h2>
          <ul className="space-y-3">
            {flagged.map((r) => {
              const queueItem = queueItems.find((q) => q.reviewId === r.id);
              const reportSummary = reportSummaries[r.id];
              const authorProfile = authorProfileByReviewId[r.id];
              return (
                <li key={r.id}>
                  <ModerationReviewCard
                    review={r}
                    onActionDone={handleDone}
                    priorityLevel={queueItem?.priorityLevel}
                    reportReasons={reportSummary?.reasons}
                    autoModerationHint={queueItem?.reasons?.[0]}
                    authorRiskLevel={authorProfile?.authorRiskLevel}
                    authorTrustScore={authorProfile?.authorTrustScore}
                    authorReviewCount={authorProfile?.authorReviewCount}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {underReview.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">검토 대기 리뷰</h2>
          <ul className="space-y-3">
            {underReview.map((r) => {
              const queueItem = queueItems.find((q) => q.reviewId === r.id);
              const reportSummary = reportSummaries[r.id];
              const authorProfile = authorProfileByReviewId[r.id];
              return (
                <li key={r.id}>
                  <ModerationReviewCard
                    review={r}
                    onActionDone={handleDone}
                    priorityLevel={queueItem?.priorityLevel}
                    reportReasons={reportSummary?.reasons}
                    autoModerationHint={queueItem?.reasons?.[0]}
                    authorRiskLevel={authorProfile?.authorRiskLevel}
                    authorTrustScore={authorProfile?.authorTrustScore}
                    authorReviewCount={authorProfile?.authorReviewCount}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">숨김 리뷰</h2>
          <ul className="space-y-3">
            {hidden.map((r) => {
              const queueItem = queueItems.find((q) => q.reviewId === r.id);
              const reportSummary = reportSummaries[r.id];
              const authorProfile = authorProfileByReviewId[r.id];
              return (
                <li key={r.id}>
                  <ModerationReviewCard
                    review={r}
                    onActionDone={handleDone}
                    priorityLevel={queueItem?.priorityLevel}
                    reportReasons={reportSummary?.reasons}
                    autoModerationHint={queueItem?.reasons?.[0]}
                    authorRiskLevel={authorProfile?.authorRiskLevel}
                    authorTrustScore={authorProfile?.authorTrustScore}
                    authorReviewCount={authorProfile?.authorReviewCount}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {Object.keys(moderationHistoryByReview).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">최근 Moderation 이력</h2>
          <div className="space-y-2">
            {Object.entries(moderationHistoryByReview).slice(0, 5).map(([reviewId, items]) => (
              <div key={reviewId} className="rounded-lg border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">리뷰 {reviewId.slice(0, 8)}…</p>
                <ReviewModerationHistoryList items={items} />
              </div>
            ))}
          </div>
        </section>
      )}

      {flagged.length === 0 && underReview.length === 0 && hidden.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">현재 검토가 필요한 리뷰가 없습니다.</p>
      )}
    </div>
  );
}
