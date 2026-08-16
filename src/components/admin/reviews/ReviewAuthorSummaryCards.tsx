"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";

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
      <AdminSummaryCard title="Total Authors" value={totalAuthors} />
      <AdminSummaryCard
        title="High Risk"
        value={highRiskCount}
        className="bg-[var(--danger-bg)]"
        valueClassName="text-[var(--danger)]"
      />
      <AdminSummaryCard
        title="Medium Risk"
        value={mediumRiskCount}
        className="bg-[var(--warning-bg)]"
        valueClassName="text-[var(--warning)]"
      />
      <AdminSummaryCard
        title="Low Risk"
        value={lowRiskCount}
        className="bg-[var(--success-bg)]"
        valueClassName="text-[var(--success)]"
      />
      <AdminSummaryCard
        title="Avg Author Trust"
        value={Math.round(averageAuthorTrust)}
      />
    </div>
  );
}
