"use client";

import { useMemo } from "react";
import type { AdminAnalyticsOverview, AnalyticsSearchKeywordStat, AnalyticsTopItem } from "@/lib/adminAnalytics";

export type SearchInsightsModel = {
  topSearchKeywords: AnalyticsSearchKeywordStat[];
  topNoResultKeywords: AnalyticsSearchKeywordStat[];
  topMegaMenuItems: AnalyticsTopItem[];
};

const TOP_N = 5;

export function buildSearchInsightsModel(
  analytics: AdminAnalyticsOverview | null | undefined,
): SearchInsightsModel {
  return {
    topSearchKeywords: (analytics?.topSearchKeywords ?? []).slice(0, TOP_N),
    topNoResultKeywords: (analytics?.topNoResultKeywords ?? []).slice(0, TOP_N),
    topMegaMenuItems: (analytics?.topMegaMenuItems ?? []).slice(0, TOP_N),
  };
}

export function useSearchInsightsModel(analytics: AdminAnalyticsOverview | null | undefined): SearchInsightsModel {
  return useMemo(() => buildSearchInsightsModel(analytics), [analytics]);
}
