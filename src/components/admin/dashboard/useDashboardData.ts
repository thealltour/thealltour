"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";
import type { Inquiry } from "@/types/inquiry";
import type { AdminNotificationItem } from "@/lib/adminNotifications";
import { takePriorityNotifications } from "./useNotificationsPriority";

export type DashboardAdminCounts = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  totalInquiries: number;
  pendingInquiries: number;
  completedInquiries: number;
  reservedInquiries: number;
  /** consultation_status === on_hold */
  onHoldInquiries: number;
  delayedInquiries: number;
  completionRate: number;
  totalInquiriesDeltaPercent?: number | null;
  pendingInquiriesDeltaPercent?: number | null;
  completedInquiriesDeltaPercent?: number | null;
  delayedInquiriesDeltaPercent?: number | null;
};

export type DashboardResponse = {
  counts: DashboardAdminCounts;
  unreadNotificationCount: number;
  analytics?: AdminAnalyticsOverview | null;
};

type InquiriesListResponse = {
  items?: Inquiry[];
  message?: string;
};

type NotificationsApiResponse = {
  unreadCount?: number;
  notifications?: AdminNotificationItem[];
  message?: string;
};

export function useDashboardData() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentRange = searchParams.get("range") ?? "7d";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";

  function updateRange(range: string, from?: string, to?: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", range);
    if (range === "custom") {
      if (from) next.set("from", from);
      if (to) next.set("to", to);
    } else {
      next.delete("from");
      next.delete("to");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const dashboardQuery = useQuery<DashboardResponse>({
    queryKey: ["admin-dashboard", { range: currentRange, from: currentFrom, to: currentTo }],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (currentRange) query.set("range", currentRange);
      if (currentRange === "custom") {
        if (currentFrom) query.set("from", currentFrom);
        if (currentTo) query.set("to", currentTo);
      }
      const queryString = query.toString();
      const url = queryString ? `/api/admin/dashboard?${queryString}` : "/api/admin/dashboard";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch admin dashboard data");
      }
      return (await response.json()) as DashboardResponse;
    },
  });

  const inquiriesQuery = useQuery<Inquiry[]>({
    queryKey: ["admin-dashboard-recent-inquiries"],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "5", sort: "recent" });
      const response = await fetch(`/api/inquiries?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as InquiriesListResponse;
      if (!response.ok) {
        throw new Error(json.message ?? "Failed to fetch inquiries");
      }
      return (json.items ?? []).slice(0, 3);
    },
  });

  const notificationsQuery = useQuery<AdminNotificationItem[]>({
    queryKey: ["admin-dashboard-recent-notifications"],
    queryFn: async () => {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const json = (await response.json()) as NotificationsApiResponse;
      if (!response.ok) {
        throw new Error(json.message ?? "Failed to fetch notifications");
      }
      return takePriorityNotifications(json.notifications ?? [], 3);
    },
  });

  const data = dashboardQuery.data;
  const counts = data?.counts;
  const unreadNotificationCount = data?.unreadNotificationCount ?? 0;

  return {
    counts,
    unreadNotificationCount,
    analytics: data?.analytics,
    recentInquiries: inquiriesQuery.data ?? [],
    recentNotifications: notificationsQuery.data ?? [],
    dashboardQuery,
    inquiriesQuery,
    notificationsQuery,
    currentRange,
    currentFrom,
    currentTo,
    updateRange,
  };
}

/** 자동 인사이트: `useDashboardInsights` + `collectDashboardInsights` / `insightRules` */
export { collectDashboardInsights, INSIGHT_THRESHOLDS } from "./insightRules";
export { useDashboardInsights } from "./useDashboardInsights";
export type { DashboardInsight, InsightSeverity } from "./insightRules";
