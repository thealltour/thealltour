"use client";

import type { ReviewProductConversionSummary } from "@/types/reviewConversionAnalytics";

type ReviewConversionByProductTableProps = {
  rows: ReviewProductConversionSummary[];
};

export function ReviewConversionByProductTable({ rows }: ReviewConversionByProductTableProps) {
  const sorted = [...rows].sort((a, b) => b.attributedConversions - a.attributedConversions).slice(0, 50);

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
        상품별 리뷰 전환 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="px-3 py-2 font-medium">Product ID</th>
            <th className="px-3 py-2 font-medium text-right">리뷰 노출</th>
            <th className="px-3 py-2 font-medium text-right">리뷰 상호작용</th>
            <th className="px-3 py-2 font-medium text-right">귀속 전환</th>
            <th className="px-3 py-2 font-medium text-right">리뷰 기여율</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.productId} className="border-b border-[var(--border)]">
              <td className="px-3 py-2 font-mono text-xs">{r.productId}</td>
              <td className="px-3 py-2 text-right">{r.reviewImpressions}</td>
              <td className="px-3 py-2 text-right">{r.reviewInteractions}</td>
              <td className="px-3 py-2 text-right">{r.attributedConversions.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">
                {r.reviewInteractions > 0 ? (r.reviewAssistRate * 100).toFixed(1) : "-"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
