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
        className="bg-red-50"
        valueClassName="text-red-800"
      />
      <AdminSummaryCard
        title="Medium Risk"
        value={mediumRiskCount}
        className="bg-amber-50"
        valueClassName="text-amber-800"
      />
      <AdminSummaryCard
        title="Low Risk"
        value={lowRiskCount}
        className="bg-green-50"
        valueClassName="text-green-800"
      />
      <AdminSummaryCard
        title="Avg Author Trust"
        value={Math.round(averageAuthorTrust)}
      />
    </div>
  );
}
