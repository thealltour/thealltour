import { Suspense } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminLandingAnalyticsPage from "@/components/admin/landings/AdminLandingAnalyticsPage";
import {
  ADMIN_LANDINGS_DESCRIPTION,
  ADMIN_LANDINGS_TITLE,
} from "@/components/admin/landings/adminLandings.constants";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminLandingsAnalyticsPageRoute() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title={`${ADMIN_LANDINGS_TITLE} · 성과 분석`}
          description={`${ADMIN_LANDINGS_DESCRIPTION} 랜딩별 조회·CTA·문의 전환(CTR/CVR)을 기간별로 확인합니다.`}
          unreadNotificationCount={unreadNotificationCount}
        />

        <Suspense
          fallback={
            <div className="animate-pulse space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
                  />
                ))}
              </div>
              <div className="h-[320px] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
            </div>
          }
        >
          <AdminLandingAnalyticsPage />
        </Suspense>
      </main>
    </div>
  );
}
