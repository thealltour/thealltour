import AdminHeader from "@/components/admin/AdminHeader";
import AdminPointsGrantManager from "@/components/admin/AdminPointsGrantManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminPointsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="points"
          title="포인트 지급 관리"
          description="회원 검색 후 포인트를 지급하고, 지급 내역을 확인할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <div className="flex justify-end">
          <a
            href="/admin/points/requests"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            적립 요청 관리로 이동
          </a>
        </div>

        <AdminPointsGrantManager />
      </main>
    </div>
  );
}
