"use client";

import type { ReviewConversionSummary } from "@/types/reviewConversionAnalytics";

type ReviewConversionByReviewTableProps = {
  rows: ReviewConversionSummary[];
};

export function ReviewConversionByReviewTable({ rows }: ReviewConversionByReviewTableProps) {
  const sorted = [...rows].sort((a, b) => (b.conversions || 0) - (a.conversions || 0)).slice(0, 100);

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
        리뷰별 전환 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="px-3 py-2 font-medium">Review ID</th>
            <th className="px-3 py-2 font-medium">Product ID</th>
            <th className="px-3 py-2 font-medium">Variant</th>
            <th className="px-3 py-2 font-medium text-right">Impressions</th>
            <th className="px-3 py-2 font-medium text-right">Clicks</th>
            <th className="px-3 py-2 font-medium text-right">Expands</th>
            <th className="px-3 py-2 font-medium text-right">Helpful</th>
            <th className="px-3 py-2 font-medium text-right">Conversions</th>
            <th className="px-3 py-2 font-medium text-right">Assisted</th>
            <th className="px-3 py-2 font-medium text-right">CVR %</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.productId}-${r.reviewId ?? i}`} className="border-b border-[var(--border)]">
              <td className="px-3 py-2 font-mono text-xs">{r.reviewId ?? "-"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.productId}</td>
              <td className="px-3 py-2">{r.variant ?? "-"}</td>
              <td className="px-3 py-2 text-right">{r.impressions}</td>
              <td className="px-3 py-2 text-right">{r.clicks}</td>
              <td className="px-3 py-2 text-right">{r.expands}</td>
              <td className="px-3 py-2 text-right">{r.helpfulClicks}</td>
              <td className="px-3 py-2 text-right">{r.conversions.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{r.assistedConversions}</td>
              <td className="px-3 py-2 text-right">
                {r.impressions > 0 ? ((r.conversionRate ?? 0) * 100).toFixed(2) : "-"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
