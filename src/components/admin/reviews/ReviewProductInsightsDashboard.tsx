"use client";

import type { ProductReviewInsightReport } from "@/types/reviewProductInsights";
import { ReviewInsightSummaryCards } from "./ReviewInsightSummaryCards";
import { ProductInsightHealthBadge } from "./ProductInsightHealthBadge";
import { ProductInsightReportCard } from "./ProductInsightReportCard";
import { ProductInsightPriorityTable } from "./ProductInsightPriorityTable";

type ReviewProductInsightsDashboardProps = {
  reports: ProductReviewInsightReport[];
};

export function ReviewProductInsightsDashboard({ reports }: ReviewProductInsightsDashboardProps) {
  const totalProducts = reports.length;
  const healthyCount = reports.filter((r) => r.reviewHealth === "healthy").length;
  const watchCount = reports.filter((r) => r.reviewHealth === "watch").length;
  const riskCount = reports.filter((r) => r.reviewHealth === "risk").length;
  const complaintSignalsCount = reports.filter((r) => r.recurringComplaints.length > 0).length;

  const riskAndWatch = reports.filter((r) => r.reviewHealth === "risk" || r.reviewHealth === "watch");

  return (
    <div className="space-y-8">
      <ReviewInsightSummaryCards
        totalProducts={totalProducts}
        healthyCount={healthyCount}
        watchCount={watchCount}
        riskCount={riskCount}
        complaintSignalsCount={complaintSignalsCount}
      />

      {riskAndWatch.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            Risk / Watch 상품 요약
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-medium">Product ID</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium text-right">리뷰 수</th>
                  <th className="px-3 py-2 font-medium text-right">평균 평점</th>
                  <th className="px-3 py-2 font-medium">요약</th>
                </tr>
              </thead>
              <tbody>
                {riskAndWatch.slice(0, 20).map((r) => (
                  <tr key={r.productId} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 font-mono text-xs">{r.productId}</td>
                    <td className="px-3 py-2">
                      <ProductInsightHealthBadge health={r.reviewHealth} />
                    </td>
                    <td className="px-3 py-2 text-right">{r.totalReviews}</td>
                    <td className="px-3 py-2 text-right">{r.averageRating.toFixed(1)}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-xs">{r.summaryText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">개선 우선순위</h2>
        <ProductInsightPriorityTable reports={reports} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품별 인사이트 리포트</h2>
        <div className="space-y-4">
          {reports.slice(0, 50).map((report) => (
            <ProductInsightReportCard key={report.productId} report={report} />
          ))}
        </div>
        {reports.length > 50 && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            상위 50개 상품만 표시합니다. (총 {reports.length}개)
          </p>
        )}
      </section>
    </div>
  );
}
