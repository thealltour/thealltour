import AdminHeader from "@/components/AdminHeader";
import EarnRequestRequestsManager from "@/components/admin/points/EarnRequestRequestsManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminPointRequestsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="points"
          title="포인트 적립 요청 관리"
          description="예약 증빙 기반 적립 요청을 검수하고 승인/반려 처리합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <EarnRequestRequestsManager />
      </main>
    </div>
  );
}
