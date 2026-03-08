"use client";

import type { ProductReviewInsightReport } from "@/types/reviewProductInsights";
import { ProductInsightHealthBadge } from "./ProductInsightHealthBadge";

type ProductInsightPriorityTableProps = {
  reports: ProductReviewInsightReport[];
};

export function ProductInsightPriorityTable({ reports }: ProductInsightPriorityTableProps) {
  const priority = reports
    .filter((r) => r.reviewHealth !== "healthy" || r.recurringComplaints.length > 0)
    .map((r) => ({
      productId: r.productId,
      health: r.reviewHealth,
      topIssue:
        r.recurringComplaints[0] ?? r.topWeaknesses[0] ?? r.anomalyWarnings[0] ?? "-",
      avgRating: r.averageRating,
      complaintCount: r.recurringComplaints.length,
      conversionRisk:
        r.conversionDrivers.some((d) => d.includes("충분하지 않습니다")) && r.totalReviews >= 10
          ? "저전환"
          : "-",
      suggestedAction: r.operationalSuggestions[0] ?? r.improvementPriorities[0] ?? "-",
    }))
    .sort((a, b) => {
      const order = { risk: 0, watch: 1, healthy: 2 };
      return (order[a.health as keyof typeof order] ?? 2) - (order[b.health as keyof typeof order] ?? 2);
    })
    .slice(0, 30);

  if (priority.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
        개선 우선순위가 높은 상품이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="px-3 py-2 font-medium">Product ID</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-3 py-2 font-medium">주요 이슈</th>
            <th className="px-3 py-2 font-medium text-right">평점</th>
            <th className="px-3 py-2 font-medium text-right">불만 수</th>
            <th className="px-3 py-2 font-medium">전환 리스크</th>
            <th className="px-3 py-2 font-medium">제안 액션</th>
          </tr>
        </thead>
        <tbody>
          {priority.map((row) => (
            <tr key={row.productId} className="border-b border-[var(--border)]">
              <td className="px-3 py-2 font-mono text-xs">{row.productId}</td>
              <td className="px-3 py-2">
                <ProductInsightHealthBadge health={row.health} />
              </td>
              <td className="max-w-[200px] truncate px-3 py-2" title={row.topIssue}>
                {row.topIssue}
              </td>
              <td className="px-3 py-2 text-right">{row.avgRating.toFixed(1)}</td>
              <td className="px-3 py-2 text-right">{row.complaintCount}</td>
              <td className="px-3 py-2">{row.conversionRisk}</td>
              <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={row.suggestedAction}>
                {row.suggestedAction}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
