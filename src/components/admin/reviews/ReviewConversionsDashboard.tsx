"use client";

import type {
  ReviewConversionSummary,
  ReviewVariantConversionSummary,
  ReviewProductConversionSummary,
} from "@/types/reviewConversionAnalytics";
import type { VariantLiftResult } from "@/lib/reviewConversionComparisons";
import { ReviewConversionSummaryCards } from "./ReviewConversionSummaryCards";
import { ReviewConversionByReviewTable } from "./ReviewConversionByReviewTable";
import { ReviewConversionByVariantTable } from "./ReviewConversionByVariantTable";
import { ReviewConversionByProductTable } from "./ReviewConversionByProductTable";

type ReviewConversionsDashboardProps = {
  reviewSummaries: ReviewConversionSummary[];
  variantSummaries: ReviewVariantConversionSummary[];
  productSummaries: ReviewProductConversionSummary[];
  totalConversions: number;
  totalAttributedConversions: number;
  variantLift: VariantLiftResult[];
  hasData: boolean;
};

export function ReviewConversionsDashboard({
  reviewSummaries,
  variantSummaries,
  productSummaries,
  totalConversions,
  totalAttributedConversions,
  variantLift,
  hasData,
}: ReviewConversionsDashboardProps) {
  if (!hasData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
        <p className="text-[var(--text-muted)]">아직 리뷰 전환 데이터가 충분하지 않습니다.</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          상품 상세에서 리뷰 노출·클릭·전환 이벤트가 수집되면 이곳에 집계됩니다.
        </p>
      </div>
    );
  }

  const totalImpressions = reviewSummaries.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = reviewSummaries.reduce((s, r) => s + r.clicks, 0);
  const attributionCoverage =
    totalConversions > 0 ? totalAttributedConversions / totalConversions : 0;

  return (
    <div className="space-y-8">
      <ReviewConversionSummaryCards
        totalImpressions={totalImpressions}
        totalClicks={totalClicks}
        totalConversions={totalConversions}
        totalAttributedConversions={totalAttributedConversions}
        attributionCoverage={attributionCoverage}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Variant별 전환 성과</h2>
        <ReviewConversionByVariantTable
          variantSummaries={variantSummaries}
          variantLift={variantLift}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">리뷰별 전환 기여도</h2>
        <ReviewConversionByReviewTable rows={reviewSummaries} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품별 리뷰 전환 성과</h2>
        <ReviewConversionByProductTable rows={productSummaries} />
      </section>
    </div>
  );
}
