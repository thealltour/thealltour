"use client";

import AdminDashboardAlertStrip from "./AdminDashboardAlertStrip";
import AdminDashboardCompactKpiGrid from "./AdminDashboardCompactKpiGrid";
import AdminDashboardPriorityPanel from "./AdminDashboardPriorityPanel";
import AdminDashboardRecentSection from "./AdminDashboardRecentSection";
import type { DashboardAdminCounts } from "./useDashboardData";
import type { DashboardPriorityItem } from "./useDashboardPriority";
import type { Inquiry } from "@/types/inquiry";
import type { AdminNotificationItem } from "@/lib/adminNotifications";

type DashboardOpsTabProps = {
  counts: DashboardAdminCounts | undefined;
  countsLoading: boolean;
  stripAndPanelLoading: boolean;
  priorityItems: DashboardPriorityItem[];
  reviewRiskCount: number;
  unreadNotificationCount: number;
  recentInquiries: Inquiry[];
  recentNotifications: AdminNotificationItem[];
  inquiriesLoading: boolean;
  inquiriesError: boolean;
  notificationsLoading: boolean;
  notificationsError: boolean;
};

export default function DashboardOpsTab({
  counts,
  countsLoading,
  stripAndPanelLoading,
  priorityItems,
  reviewRiskCount,
  unreadNotificationCount,
  recentInquiries,
  recentNotifications,
  inquiriesLoading,
  inquiriesError,
  notificationsLoading,
  notificationsError,
}: DashboardOpsTabProps) {
  return (
    <div className="space-y-2.5 max-md:space-y-2 md:space-y-4">
      <AdminDashboardAlertStrip
        pendingInquiries={counts?.pendingInquiries ?? 0}
        delayedInquiries={counts?.delayedInquiries ?? 0}
        unreadNotificationCount={unreadNotificationCount}
        reservedInquiries={counts?.reservedInquiries ?? 0}
        reviewRiskCount={reviewRiskCount}
        isLoading={stripAndPanelLoading}
      />

      <AdminDashboardPriorityPanel items={priorityItems} isLoading={stripAndPanelLoading} />

      <AdminDashboardCompactKpiGrid counts={counts} isLoading={countsLoading} />

      <AdminDashboardRecentSection
        recentInquiries={recentInquiries}
        recentNotifications={recentNotifications}
        inquiriesLoading={inquiriesLoading}
        inquiriesError={inquiriesError}
        notificationsLoading={notificationsLoading}
        notificationsError={notificationsError}
      />
    </div>
  );
}
