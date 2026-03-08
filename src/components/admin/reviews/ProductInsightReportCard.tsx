"use client";

import type { ProductReviewInsightReport } from "@/types/reviewProductInsights";
import { ProductInsightHealthBadge } from "./ProductInsightHealthBadge";
import { ProductInsightSectionList } from "./ProductInsightSectionList";

type ProductInsightReportCardProps = {
  report: ProductReviewInsightReport;
};

export function ProductInsightReportCard({ report }: ProductInsightReportCardProps) {
  const isRiskOrWatch = report.reviewHealth === "risk" || report.reviewHealth === "watch";
  return (
    <div
      className={`rounded-xl border p-4 ${
        isRiskOrWatch
          ? "border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/20"
          : "border-[var(--border)] bg-[var(--surface-muted)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
          {report.productId}
        </span>
        <ProductInsightHealthBadge health={report.reviewHealth} />
        <span className="text-xs text-[var(--text-muted)]">
          리뷰 {report.totalReviews}건 · 평균 {report.averageRating.toFixed(1)}점
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-primary)]">{report.summaryText}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ProductInsightSectionList label="강점" items={report.topStrengths} />
        <ProductInsightSectionList label="약점" items={report.topWeaknesses} />
        <ProductInsightSectionList label="반복 불만" items={report.recurringComplaints} />
        <ProductInsightSectionList label="추천 포인트" items={report.recommendationDrivers} />
        <ProductInsightSectionList label="전환 기여" items={report.conversionDrivers} />
        <ProductInsightSectionList label="Trust 경고" items={report.trustWarnings} />
        <ProductInsightSectionList label="이상 경고" items={report.anomalyWarnings} />
        <ProductInsightSectionList label="검토 경고" items={report.moderationWarnings} />
        <ProductInsightSectionList label="운영 제안" items={report.operationalSuggestions} />
        <ProductInsightSectionList label="개선 우선순위" items={report.improvementPriorities} />
      </div>
      {report.trendSummary && (
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-muted)]">
          추세: {report.trendSummary}
        </p>
      )}
    </div>
  );
}
