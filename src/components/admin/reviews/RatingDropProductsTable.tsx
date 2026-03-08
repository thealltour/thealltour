"use client";

import Link from "next/link";
import type { RatingDropProduct } from "@/types/reviewAnomalies";

type RatingDropProductsTableProps = {
  products: RatingDropProduct[];
};

export function RatingDropProductsTable({ products }: RatingDropProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">평점 급락 상품</h3>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          최근 기간 기준 평점 급락 상품이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">평점 급락 상품</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          최근 14일 vs 이전 30일 평균 평점 (ratingDelta ASC)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="p-3 font-medium">Product ID</th>
              <th className="p-3 font-medium">Previous Avg</th>
              <th className="p-3 font-medium">Recent Avg</th>
              <th className="p-3 font-medium">Delta</th>
              <th className="p-3 font-medium">Previous Count</th>
              <th className="p-3 font-medium">Recent Count</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId} className="border-b border-[var(--border)]/50 last:border-0">
                <td className="p-3">
                  <Link
                    href={`/products/${p.productId}`}
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    {p.productId}
                  </Link>
                </td>
                <td className="p-3">{p.previousAverageRating.toFixed(2)}</td>
                <td className="p-3">{p.recentAverageRating.toFixed(2)}</td>
                <td className="p-3 font-medium text-red-600">{p.ratingDelta.toFixed(2)}</td>
                <td className="p-3">{p.previousCount}</td>
                <td className="p-3">{p.recentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
