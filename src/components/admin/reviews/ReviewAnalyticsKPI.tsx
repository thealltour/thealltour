"use client";

import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type ReviewAnalyticsKPIProps = {
  analytics: ReviewAnalyticsResult;
};

export function ReviewAnalyticsKPI({ analytics }: ReviewAnalyticsKPIProps) {
  const last30Total = analytics.recentReviewTrend.reduce((s, d) => s + d.count, 0);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <AdminStatCard title="Total Reviews" value={analytics.totalReviews} />
      <AdminStatCard title="Average Rating" value={analytics.averageRating.toFixed(1)} />
      <AdminStatCard
        title="Verified Review Ratio"
        value={`${(analytics.verifiedRatio * 100).toFixed(1)}%`}
      />
      <AdminStatCard title="Last 30 Days Reviews" value={last30Total} />
    </div>
  );
}
