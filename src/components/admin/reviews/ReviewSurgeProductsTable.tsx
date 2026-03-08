"use client";

import Link from "next/link";
import type { ReviewSurgeProduct } from "@/types/reviewAnomalies";

type ReviewSurgeProductsTableProps = {
  products: ReviewSurgeProduct[];
};

export function ReviewSurgeProductsTable({ products }: ReviewSurgeProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">리뷰 급증 상품</h3>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          최근 7일 기준 리뷰 급증 상품이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">리뷰 급증 상품</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          최근 7일 vs 이전 30일 일평균 (surgeRatio DESC)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="p-3 font-medium">Product ID</th>
              <th className="p-3 font-medium">Recent 7D</th>
              <th className="p-3 font-medium">Previous 30D</th>
              <th className="p-3 font-medium">Recent/Day</th>
              <th className="p-3 font-medium">Previous/Day</th>
              <th className="p-3 font-medium">Surge Ratio</th>
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
                <td className="p-3">{p.recent7dCount}</td>
                <td className="p-3">{p.previous30dCount}</td>
                <td className="p-3">{p.recent7dPerDay.toFixed(2)}</td>
                <td className="p-3">{p.previous30dPerDay.toFixed(2)}</td>
                <td className="p-3 font-medium text-amber-600">{p.surgeRatio.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
