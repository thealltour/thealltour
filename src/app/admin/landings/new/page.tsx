import AdminHeader from "@/components/admin/AdminHeader";
import AdminLandingFormPage from "@/components/admin/landings/AdminLandingFormPage";
import { ADMIN_LANDINGS_TITLE } from "@/components/admin/landings/adminLandings.constants";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminLandingsNewPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="landings"
          title={`${ADMIN_LANDINGS_TITLE} · 생성`}
          description="검색/유입 랜딩의 기본 정보를 입력하고 draft로 저장합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminLandingFormPage mode="create" />
      </main>
    </div>
  );
}
