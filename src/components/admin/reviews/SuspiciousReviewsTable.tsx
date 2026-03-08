"use client";

import Link from "next/link";
import type { SuspiciousReviewItem } from "@/types/reviewAnomalies";

type SuspiciousReviewsTableProps = {
  reviews: SuspiciousReviewItem[];
};

export function SuspiciousReviewsTable({ reviews }: SuspiciousReviewsTableProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">의심 리뷰</h3>
        <p className="mt-2 text-xs text-[var(--text-muted)]">스팸 의심 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">의심 리뷰</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          riskScore DESC, createdAt DESC
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="p-3 font-medium">Review ID</th>
              <th className="p-3 font-medium">Product ID</th>
              <th className="p-3 font-medium">Rating</th>
              <th className="p-3 font-medium">Verified</th>
              <th className="p-3 font-medium">Helpful</th>
              <th className="p-3 font-medium">Risk</th>
              <th className="p-3 font-medium">Reasons</th>
              <th className="p-3 font-medium">Content Preview</th>
              <th className="p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)]/50 last:border-0">
                <td className="p-3">
                  <Link
                    href={`/reviews/${r.id}`}
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    {r.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="p-3">
                  <Link
                    href={`/products/${r.productId}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {r.productId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="p-3">{r.rating}</td>
                <td className="p-3">
                  {r.verified ? (
                    <span className="text-green-600">Y</span>
                  ) : (
                    <span className="text-amber-600">N</span>
                  )}
                </td>
                <td className="p-3">{r.helpfulCount}</td>
                <td className="p-3">
                  <span
                    className={
                      r.riskScore >= 5
                        ? "font-semibold text-red-600"
                        : r.riskScore >= 3
                          ? "font-medium text-amber-600"
                          : "text-slate-600"
                    }
                  >
                    {r.riskScore}
                  </span>
                </td>
                <td className="max-w-[160px] p-3">
                  <span className="flex flex-wrap gap-1">
                    {r.reasons.map((reason, i) => (
                      <span
                        key={i}
                        className="inline rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                      >
                        {reason}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="max-w-[200px] truncate p-3 text-[var(--text-secondary)]">
                  {r.contentPreview}
                </td>
                <td className="p-3 text-xs text-[var(--text-muted)]">
                  {r.createdAt ? r.createdAt.slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
