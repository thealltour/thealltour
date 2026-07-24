"use client";

import { useSearchParams } from "next/navigation";
import AdminKakaoSyncAnalyticsPage from "@/components/admin/landings/AdminKakaoSyncAnalyticsPage";
import { useDashboardData } from "./useDashboardData";
import { useReviewSummary } from "./useReviewSummary";
import { useDashboardPriority } from "./useDashboardPriority";
import { useFunnelModel } from "./useFunnelData";
import { useSearchInsightsModel } from "./useSearchInsights";
import { useDashboardInsights } from "./useDashboardInsights";
import DashboardOpsTab from "./DashboardOpsTab";
import DashboardMetricsTab from "./DashboardMetricsTab";

type DashboardTab = "ops" | "metrics" | "kakao_sync";

function resolveDashboardTab(raw: string | null): DashboardTab {
  if (raw === "metrics") return "metrics";
  if (raw === "kakao_sync") return "kakao_sync";
  return "ops";
}

function AdminDashboardOpsOrMetrics({ tab }: { tab: "ops" | "metrics" }) {
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

  if (tab === "metrics") {
    return (
      <DashboardMetricsTab
        data={data}
        counts={counts}
        dashLoading={dashLoading}
        dashError={dashError}
        onRefetch={() => {
          void refetch();
        }}
        analyticsBlockLoading={analyticsBlockLoading}
        currentRange={currentRange}
        currentFrom={currentFrom}
        currentTo={currentTo}
        updateRange={updateRange}
        funnelModel={funnelModel}
        searchInsightsModel={searchInsightsModel}
        insightItems={insightItems}
        insightsLoading={insightsLoading}
      />
    );
  }

  return (
    <DashboardOpsTab
      counts={counts}
      countsLoading={countsLoading}
      stripAndPanelLoading={stripAndPanelLoading}
      priorityItems={priorityItems}
      reviewRiskCount={reviewRiskCount}
      unreadNotificationCount={unreadNotificationCount}
      recentInquiries={recentInquiries}
      recentNotifications={recentNotifications}
      inquiriesLoading={inquiriesQuery.isLoading}
      inquiriesError={inquiriesQuery.isError}
      notificationsLoading={notificationsQuery.isLoading}
      notificationsError={notificationsQuery.isError}
    />
  );
}

export default function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const dashboardTab = resolveDashboardTab(searchParams.get("tab"));

  if (dashboardTab === "kakao_sync") {
    return <AdminKakaoSyncAnalyticsPage />;
  }

  return <AdminDashboardOpsOrMetrics tab={dashboardTab} />;
}
