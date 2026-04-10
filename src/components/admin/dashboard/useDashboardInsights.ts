"use client";

import { useMemo } from "react";
import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";
import type { AdminNotificationItem } from "@/lib/adminNotifications";
import type { DashboardAdminCounts } from "./useDashboardData";
import type { FunnelConversionRates } from "./useFunnelData";
import { collectDashboardInsights, type DashboardInsight } from "./insightRules";

export type { DashboardInsight, InsightSeverity } from "./insightRules";

export type UseDashboardInsightsInput = {
  counts: DashboardAdminCounts | undefined;
  analytics: AdminAnalyticsOverview | null | undefined;
  funnelConversionRates: FunnelConversionRates;
  unreadNotificationCount: number;
  flaggedCount: number;
  highPriorityCount: number;
  recentNotifications: AdminNotificationItem[];
  maxItems?: number;
};

export function useDashboardInsights({
  counts,
  analytics,
  funnelConversionRates,
  unreadNotificationCount,
  flaggedCount,
  highPriorityCount,
  recentNotifications,
  maxItems = 5,
}: UseDashboardInsightsInput): DashboardInsight[] {
  return useMemo(
    () =>
      collectDashboardInsights(
        {
          counts,
          analytics,
          funnelConversionRates,
          unreadNotificationCount,
          flaggedCount,
          highPriorityCount,
          recentNotifications,
        },
        maxItems,
      ),
    [
      counts,
      analytics,
      funnelConversionRates,
      unreadNotificationCount,
      flaggedCount,
      highPriorityCount,
      recentNotifications,
      maxItems,
    ],
  );
}
