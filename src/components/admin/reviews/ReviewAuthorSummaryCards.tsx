"use client";

type ReviewAuthorSummaryCardsProps = {
  totalAuthors: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  averageAuthorTrust: number;
};

export function ReviewAuthorSummaryCards({
  totalAuthors,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
  averageAuthorTrust,
}: ReviewAuthorSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Total Authors</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalAuthors}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-red-50 p-4">
        <p className="text-xs font-medium text-red-700">High Risk</p>
        <p className="mt-1 text-2xl font-semibold text-red-800">{highRiskCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-amber-50 p-4">
        <p className="text-xs font-medium text-amber-700">Medium Risk</p>
        <p className="mt-1 text-2xl font-semibold text-amber-800">{mediumRiskCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-green-50 p-4">
        <p className="text-xs font-medium text-green-700">Low Risk</p>
        <p className="mt-1 text-2xl font-semibold text-green-800">{lowRiskCount}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Avg Author Trust</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
          {Math.round(averageAuthorTrust)}
        </p>
      </div>
    </div>
  );
}
