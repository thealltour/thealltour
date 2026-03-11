"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";

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
      <AdminSummaryCard title="전체 상품" value={totalProducts} />
      <AdminSummaryCard title="Healthy" value={healthyCount} valueClassName="text-green-600" />
      <AdminSummaryCard title="Watch" value={watchCount} valueClassName="text-amber-600" />
      <AdminSummaryCard title="Risk" value={riskCount} valueClassName="text-red-600" />
      <AdminSummaryCard title="반복 불만 신호" value={complaintSignalsCount} />
    </div>
  );
}
