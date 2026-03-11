"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";

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
      <AdminSummaryCard title="Active Experiments" value={activeExperiments} />
      <AdminSummaryCard title="Total Impressions" value={totalImpressions} />
      <AdminSummaryCard title="Total Clicks" value={totalClicks} />
      <AdminSummaryCard title="Total Conversions" value={totalConversions} />
    </div>
  );
}
