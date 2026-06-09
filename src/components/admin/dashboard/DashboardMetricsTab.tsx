"use client";

import AdminDashboardAnalyticsSection from "./AdminDashboardAnalyticsSection";
import AdminDashboardDateRangeBar from "./AdminDashboardDateRangeBar";
import AdminDashboardFunnelSection from "./AdminDashboardFunnelSection";
import AdminDashboardGolfLeadsSummary from "./AdminDashboardGolfLeadsSummary";
import AdminDashboardInsights from "./AdminDashboardInsights";
import AdminDashboardSearchInsights from "./AdminDashboardSearchInsights";
import type { DashboardResponse, DashboardAdminCounts } from "./useDashboardData";
import type { FunnelModel } from "./useFunnelData";
import type { SearchInsightsModel } from "./useSearchInsights";
import type { DashboardInsight } from "./insightRules";

type DashboardMetricsTabProps = {
  data: DashboardResponse | undefined;
  counts: DashboardAdminCounts | undefined;
  dashLoading: boolean;
  dashError: boolean;
  onRefetch: () => void;
  analyticsBlockLoading: boolean;
  currentRange: string;
  currentFrom: string;
  currentTo: string;
  updateRange: (range: string, from?: string, to?: string) => void;
  funnelModel: FunnelModel;
  searchInsightsModel: SearchInsightsModel;
  insightItems: DashboardInsight[];
  insightsLoading: boolean;
};

export default function DashboardMetricsTab({
  data,
  counts,
  dashLoading,
  dashError,
  onRefetch,
  analyticsBlockLoading,
  currentRange,
  currentFrom,
  currentTo,
  updateRange,
  funnelModel,
  searchInsightsModel,
  insightItems,
  insightsLoading,
}: DashboardMetricsTabProps) {
  return (
    <div className="space-y-2.5 max-md:space-y-2 md:space-y-4">
      <AdminDashboardInsights items={insightItems} isLoading={insightsLoading} />

      <AdminDashboardDateRangeBar
        currentRange={currentRange}
        currentFrom={currentFrom}
        currentTo={currentTo}
        updateRange={updateRange}
        disabled={analyticsBlockLoading}
      />

      <AdminDashboardFunnelSection model={funnelModel} isLoading={analyticsBlockLoading} />

      <AdminDashboardGolfLeadsSummary />

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          검색·탐색 인사이트
        </h2>
        <AdminDashboardSearchInsights model={searchInsightsModel} isLoading={analyticsBlockLoading} />
      </div>

      <AdminDashboardAnalyticsSection
        data={data}
        counts={counts}
        isLoading={dashLoading}
        isError={dashError}
        onRefetch={onRefetch}
      />
    </div>
  );
}
