"use client";

import { useDashboardData } from "./useDashboardData";
import AdminDashboardAlertStrip from "./AdminDashboardAlertStrip";
import AdminDashboardCompactKpiGrid from "./AdminDashboardCompactKpiGrid";
import AdminDashboardRecentSection from "./AdminDashboardRecentSection";
import AdminDashboardAnalyticsSection from "./AdminDashboardAnalyticsSection";
import AdminDashboardPriorityPanel from "./AdminDashboardPriorityPanel";
import AdminDashboardDateRangeBar from "./AdminDashboardDateRangeBar";
import AdminDashboardFunnelSection from "./AdminDashboardFunnelSection";
import AdminDashboardSearchInsights from "./AdminDashboardSearchInsights";
import { useReviewSummary } from "./useReviewSummary";
import { useDashboardPriority } from "./useDashboardPriority";
import { useFunnelModel } from "./useFunnelData";
import { useSearchInsightsModel } from "./useSearchInsights";
import AdminDashboardInsights from "./AdminDashboardInsights";
import { useDashboardInsights } from "./useDashboardInsights";

export default function AdminDashboardContent() {
  const {
    counts,
    unreadNotificationCount,
    recentInquiries,
    recentNotifications,
    dashboardQuery,
    inquiriesQuery,
    notificationsQuery,
    currentRange,
    currentFrom,
    currentTo,
    updateRange,
  } = useDashboardData();

  const reviewSummaryQuery = useReviewSummary();

  const { data, isLoading: dashLoading, isError: dashError, refetch } = dashboardQuery;
  const countsLoading = dashLoading && !data;

  const priorityItems = useDashboardPriority({
    delayedInquiries: counts?.delayedInquiries ?? 0,
    pendingInquiries: counts?.pendingInquiries ?? 0,
    unreadNotificationCount,
    reviewSummary: reviewSummaryQuery.data,
  });

  const flaggedCount = reviewSummaryQuery.data?.flaggedCount ?? 0;
  const highPriorityCount = reviewSummaryQuery.data?.highPriorityCount ?? 0;
  const reviewRiskCount =
    flaggedCount > 0 ? flaggedCount : highPriorityCount > 0 ? highPriorityCount : 0;

  const stripAndPanelLoading = countsLoading || (reviewSummaryQuery.isLoading && !reviewSummaryQuery.data);

  const analyticsBlockLoading = dashLoading && !data;
  const funnelModel = useFunnelModel(data?.analytics, counts);
  const searchInsightsModel = useSearchInsightsModel(data?.analytics);

  const insightItems = useDashboardInsights({
    counts,
    analytics: data?.analytics,
    funnelConversionRates: funnelModel.conversionRates,
    unreadNotificationCount,
    flaggedCount,
    highPriorityCount,
    recentNotifications: notificationsQuery.data ?? [],
    maxItems: 5,
  });

  const insightsLoading = dashLoading && !data;

  return (
    <div className="space-y-2.5 max-md:space-y-2 md:space-y-4">
      <AdminDashboardInsights items={insightItems} isLoading={insightsLoading} />

      <AdminDashboardAlertStrip
        pendingInquiries={counts?.pendingInquiries ?? 0}
        delayedInquiries={counts?.delayedInquiries ?? 0}
        unreadNotificationCount={unreadNotificationCount}
        reservedInquiries={counts?.reservedInquiries ?? 0}
        reviewRiskCount={reviewRiskCount}
        isLoading={stripAndPanelLoading}
      />

      <AdminDashboardPriorityPanel items={priorityItems} isLoading={stripAndPanelLoading} />

      <div className="space-y-2.5 md:space-y-4">
        <AdminDashboardDateRangeBar
          currentRange={currentRange}
          currentFrom={currentFrom}
          currentTo={currentTo}
          updateRange={updateRange}
          disabled={analyticsBlockLoading}
        />
        <AdminDashboardFunnelSection model={funnelModel} isLoading={analyticsBlockLoading} />
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            검색·탐색 인사이트
          </h2>
          <AdminDashboardSearchInsights model={searchInsightsModel} isLoading={analyticsBlockLoading} />
        </div>
      </div>

      <AdminDashboardCompactKpiGrid counts={counts} isLoading={countsLoading} />

      <div className="flex flex-col gap-3 md:gap-4">
        <div className="order-1 md:order-2">
          <AdminDashboardRecentSection
            recentInquiries={recentInquiries}
            recentNotifications={recentNotifications}
            inquiriesLoading={inquiriesQuery.isLoading}
            inquiriesError={inquiriesQuery.isError}
            notificationsLoading={notificationsQuery.isLoading}
            notificationsError={notificationsQuery.isError}
          />
        </div>

        <div className="order-2 md:order-1">
          <AdminDashboardAnalyticsSection
            data={data}
            counts={counts}
            isLoading={dashLoading}
            isError={dashError}
            onRefetch={() => {
              void refetch();
            }}
          />
        </div>
      </div>
    </div>
  );
}
