import { Suspense } from "react";
import AdminDashboardKpiSectionWithProvider from "@/components/admin/AdminDashboardKpiSectionWithProvider";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import {
  AdminDashboardQuickActionsList,
  AdminDashboardResourceOverview,
} from "@/components/admin/dashboard/AdminDashboardMobileBlocks";

export default async function AdminPage() {
  const [counts, unreadNotificationCount] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
  ]);

  const { inquiryCount, productCount, memberCount, reviewCount } = counts;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] transition-colors max-md:px-3 max-md:py-3 md:px-10">
      <main className="w-full space-y-6 max-md:space-y-4">
        <AdminHeader
          activeTab="dashboard"
          title="Admin dashboard"
          description="Check today&apos;s operations and inquiry metrics in one place."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <AdminQueryProvider>
          <Suspense
            fallback={
              <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                <div className="h-10 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
                <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                <div className="h-8 animate-pulse rounded-md bg-[var(--surface-muted)]" />
                <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="h-36 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                  <div className="h-36 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                  <div className="h-36 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={index}
                      className="h-16 animate-pulse rounded-lg bg-[var(--surface-muted)]"
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                  <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                </div>
              </div>
            }
          >
            <AdminDashboardKpiSectionWithProvider />
          </Suspense>
        </AdminQueryProvider>

        <section className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 backdrop-blur-md transition-colors max-md:p-3 md:p-5">
          <article className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 transition-colors md:space-y-3 md:p-4">
            <h2 className="text-base font-bold text-[var(--text-primary)] md:text-lg">Quick actions</h2>
            <AdminDashboardQuickActionsList />
          </article>

          <article className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 transition-colors md:p-4">
            <h2 className="text-base font-bold text-[var(--text-primary)] md:text-lg">Resource overview</h2>
            <AdminDashboardResourceOverview
              productCount={productCount}
              memberCount={memberCount}
              reviewCount={reviewCount}
            />
          </article>
        </section>
      </main>
    </div>
  );
}

