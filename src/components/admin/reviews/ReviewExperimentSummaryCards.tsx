"use client";

type ReviewExperimentSummaryCardsProps = {
  activeExperiments: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
};

export function ReviewExperimentSummaryCards({
  activeExperiments,
  totalImpressions,
  totalClicks,
  totalConversions,
}: ReviewExperimentSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Active Experiments</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{activeExperiments}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Total Impressions</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalImpressions}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Total Clicks</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalClicks}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-medium text-[var(--text-muted)]">Total Conversions</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalConversions}</p>
      </div>
    </div>
  );
}
