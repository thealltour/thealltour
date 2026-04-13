import AdminHeader from "@/components/admin/AdminHeader";
import AdminLandingGenerationManager from "@/components/admin/landings/AdminLandingGenerationManager";
import { ADMIN_LANDINGS_TITLE } from "@/components/admin/landings/adminLandings.constants";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminLandingsGenerateFromTaxonomyPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="landings"
          title={`${ADMIN_LANDINGS_TITLE} · taxonomy 기반 생성`}
          description="상품이 연결된 지역/테마 taxonomy를 기준으로 랜딩 draft를 일괄 생성합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminLandingGenerationManager />
      </main>
    </div>
  );
}
