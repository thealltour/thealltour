"use client";

import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import type { ReviewAnomalyResult } from "@/types/reviewAnomalies";

type AnomalySummaryCardsProps = {
  anomalies: ReviewAnomalyResult;
};

export function AnomalySummaryCards({ anomalies }: AnomalySummaryCardsProps) {
  const { summary } = anomalies;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <AdminStatCard title="Total Alerts" value={summary.totalAlerts} />
      <AdminStatCard title="Rating Drop Products" value={summary.ratingDropCount} />
      <AdminStatCard title="Review Surge Products" value={summary.surgeCount} />
      <AdminStatCard title="Suspicious Reviews" value={summary.suspiciousReviewCount} />
    </div>
  );
}
