"use client";

import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";

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
      <AdminSummaryCard title="리뷰 노출 수" value={totalImpressions} />
      <AdminSummaryCard title="리뷰 클릭 수" value={totalClicks} />
      <AdminSummaryCard title="전환 수" value={totalConversions} />
      <AdminSummaryCard title="귀속 전환 수" value={totalAttributedConversions} />
      <AdminSummaryCard
        title="귀속률"
        value={totalConversions > 0 ? `${(attributionCoverage * 100).toFixed(1)}%` : "-"}
      />
    </div>
  );
}
