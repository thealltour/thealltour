"use client";

import type { Inquiry } from "@/types/inquiry";
import type { AdminNotificationItem } from "@/lib/adminNotifications";
import { ADMIN_DASHBOARD_SECTION_TITLE_CLASS } from "@/components/admin/mobile/dashboard/MobileAdminDashboard";
import RecentInquiriesList from "./RecentInquiriesList";
import RecentNotificationsList from "./RecentNotificationsList";

type AdminDashboardRecentSectionProps = {
  recentInquiries: Inquiry[];
  recentNotifications: AdminNotificationItem[];
  inquiriesLoading: boolean;
  inquiriesError: boolean;
  notificationsLoading: boolean;
  notificationsError: boolean;
};

export default function AdminDashboardRecentSection({
  recentInquiries,
  recentNotifications,
  inquiriesLoading,
  inquiriesError,
  notificationsLoading,
  notificationsError,
}: AdminDashboardRecentSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm md:p-4">
        <div className="mb-3 flex min-h-9 items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-2.5">
          <h3 className={ADMIN_DASHBOARD_SECTION_TITLE_CLASS}>최근 문의</h3>
          <a
            href="/admin/inquiries"
            className="inline-flex min-h-9 shrink-0 items-center rounded-md px-2 text-[11px] font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            전체 보기
          </a>
        </div>
        <RecentInquiriesList items={recentInquiries} isLoading={inquiriesLoading} isError={inquiriesError} />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm md:p-4">
        <div className="mb-3 flex min-h-9 items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-2.5">
          <h3 className={ADMIN_DASHBOARD_SECTION_TITLE_CLASS}>최근 알림</h3>
          <a
            href="/admin/notifications"
            className="inline-flex min-h-9 shrink-0 items-center rounded-md px-2 text-[11px] font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            전체 보기
          </a>
        </div>
        <RecentNotificationsList
          items={recentNotifications}
          isLoading={notificationsLoading}
          isError={notificationsError}
        />
      </section>
    </div>
  );
}
