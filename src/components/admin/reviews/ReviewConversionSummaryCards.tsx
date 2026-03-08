"use client";

type ReviewConversionSummaryCardsProps = {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalAttributedConversions: number;
  attributionCoverage: number;
};

export function ReviewConversionSummaryCards({
  totalImpressions,
  totalClicks,
  totalConversions,
  totalAttributedConversions,
  attributionCoverage,
}: ReviewConversionSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">리뷰 노출 수</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalImpressions}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">리뷰 클릭 수</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalClicks}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">전환 수</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalConversions}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">귀속 전환 수</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalAttributedConversions}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">귀속률</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
          {totalConversions > 0 ? `${(attributionCoverage * 100).toFixed(1)}%` : "-"}
        </p>
      </div>
    </div>
  );
}
