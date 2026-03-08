"use client";

import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import type { ProductReviewSummary } from "@/types/reviewSummaries";

type ReviewSummaryStatsProps = {
  summaries: ProductReviewSummary[];
};

export function ReviewSummaryStats({ summaries }: ReviewSummaryStatsProps) {
  const total = summaries.length;
  const positive = summaries.filter((s) => s.sentiment === "positive").length;
  const mixed = summaries.filter((s) => s.sentiment === "mixed").length;
  const negative = summaries.filter((s) => s.sentiment === "negative").length;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <AdminStatCard title="Total Products Summarized" value={total} />
      <AdminStatCard title="Positive Products" value={positive} />
      <AdminStatCard title="Mixed Products" value={mixed} />
      <AdminStatCard title="Negative Products" value={negative} />
    </div>
  );
}
