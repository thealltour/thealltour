"use client";

type ReviewInsightSummaryCardsProps = {
  totalProducts: number;
  healthyCount: number;
  watchCount: number;
  riskCount: number;
  complaintSignalsCount: number;
};

export function ReviewInsightSummaryCards({
  totalProducts,
  healthyCount,
  watchCount,
  riskCount,
  complaintSignalsCount,
}: ReviewInsightSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">전체 상품</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalProducts}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Healthy</p>
        <p className="mt-1 text-2xl font-semibold text-green-600">{healthyCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Watch</p>
        <p className="mt-1 text-2xl font-semibold text-amber-600">{watchCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Risk</p>
        <p className="mt-1 text-2xl font-semibold text-red-600">{riskCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">반복 불만 신호</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{complaintSignalsCount}</p>
      </div>
    </div>
  );
}
