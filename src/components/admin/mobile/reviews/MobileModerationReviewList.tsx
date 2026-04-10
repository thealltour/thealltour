"use client";

import type { ReviewModerationQueueItem } from "@/lib/reviewModerationQueue";
import type { MobileModerationReviewRow } from "@/components/admin/mobile/reviews/useMobileReviewModerationSections";
import { MobileModerationReviewCard } from "@/components/admin/mobile/reviews/MobileModerationReviewCard";

type MobileModerationReviewListProps = {
  title: string;
  reviews: MobileModerationReviewRow[];
  emptyMessage: string;
  onActionDone: () => void;
  queueItems: ReviewModerationQueueItem[];
  authorProfileByReviewId: Record<
    string,
    { authorRiskLevel: "low" | "medium" | "high"; authorTrustScore: number; authorReviewCount: number }
  >;
};

export function MobileModerationReviewList({
  title,
  reviews,
  emptyMessage,
  onActionDone,
  queueItems,
  authorProfileByReviewId,
}: MobileModerationReviewListProps) {
  if (reviews.length === 0) {
    return (
      <section className="space-y-2" aria-label={title}>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      <ul className="space-y-3" role="list">
        {reviews.map((r) => {
          const queueItem = queueItems.find((q) => q.reviewId === r.id);
          const authorProfile = authorProfileByReviewId[r.id];
          return (
            <li key={r.id}>
              <MobileModerationReviewCard
                review={r}
                onActionDone={onActionDone}
                priorityLevel={queueItem?.priorityLevel}
                authorRiskLevel={authorProfile?.authorRiskLevel}
                authorTrustScore={authorProfile?.authorTrustScore}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
