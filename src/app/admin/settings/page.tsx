import AdminHeader from "@/components/admin/AdminHeader";
import AdminSiteSettingsManager from "@/components/admin/AdminSiteSettingsManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export const dynamic = "force-dynamic";

export default async function AdminSiteSettingsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="환경설정"
          description="사이트 연락처, 회사 정보, 히어로·About·추천 검색어, 로그인 기기를 관리합니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        <div className="space-y-6">
          <AdminSiteSettingsManager />
        </div>
      </main>
    </div>
  );
}
