"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileModerationSummary } from "@/components/admin/mobile/reviews/MobileModerationSummary";
import { MobileModerationReviewList } from "@/components/admin/mobile/reviews/MobileModerationReviewList";
import { useMobileReviewModerationSections } from "@/components/admin/mobile/reviews/useMobileReviewModerationSections";
import type { ReviewModerationQueueItem } from "@/lib/reviewModerationQueue";
import type { MobileModerationReviewRow } from "@/components/admin/mobile/reviews/useMobileReviewModerationSections";

type Summary = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
  recentReportsCount: number;
};

type MobileReviewModerationSectionProps = {
  reviews: MobileModerationReviewRow[];
  queueItems: ReviewModerationQueueItem[];
  summary: Summary;
  authorProfileByReviewId: Record<
    string,
    { authorRiskLevel: "low" | "medium" | "high"; authorTrustScore: number; authorReviewCount: number }
  >;
};

/**
 * 모바일 전용 리뷰 검토 화면. 배치 액션·큐 테이블·reason breakdown 제외.
 */
export function MobileReviewModerationSection({
  reviews,
  queueItems,
  summary,
  authorProfileByReviewId,
}: MobileReviewModerationSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { flagged, underReview, hidden } = useMobileReviewModerationSections(reviews);

  const handleDone = () => router.refresh();

  useEffect(() => {
    if (searchParams.get("filter") !== "flagged") return;
    const timer = window.setTimeout(() => {
      document.getElementById("moderation-flagged")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">현재 검토가 필요한 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-2">
      <MobileModerationSummary summary={summary} />

      <div id="moderation-flagged">
        <MobileModerationReviewList
          title="신고된 리뷰"
          reviews={flagged}
          emptyMessage="신고된 리뷰가 없습니다."
          onActionDone={handleDone}
          queueItems={queueItems}
          authorProfileByReviewId={authorProfileByReviewId}
        />
      </div>

      <MobileModerationReviewList
        title="검토 대기"
        reviews={underReview}
        emptyMessage="검토 대기 리뷰가 없습니다."
        onActionDone={handleDone}
        queueItems={queueItems}
        authorProfileByReviewId={authorProfileByReviewId}
      />

      <MobileModerationReviewList
        title="숨김 리뷰"
        reviews={hidden}
        emptyMessage="숨김 처리된 리뷰가 없습니다."
        onActionDone={handleDone}
        queueItems={queueItems}
        authorProfileByReviewId={authorProfileByReviewId}
      />
    </div>
  );
}
