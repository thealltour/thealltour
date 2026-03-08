"use client";

import type { ProductReviewSummary } from "@/types/reviewSummaries";
import { ReviewSummaryStats } from "./ReviewSummaryStats";
import { ReviewSummaryFilters } from "./ReviewSummaryFilters";

type ReviewSummariesDashboardProps = {
  summaries: ProductReviewSummary[];
};

export function ReviewSummariesDashboard({ summaries }: ReviewSummariesDashboardProps) {
  return (
    <div className="space-y-8">
      <section>
        <ReviewSummaryStats summaries={summaries} />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          상품별 요약 (sentiment / 최소 리뷰 / 키워드 필터)
        </h2>
        <ReviewSummaryFilters summaries={summaries} />
      </section>
    </div>
  );
}
