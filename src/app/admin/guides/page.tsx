import AdminHeader from "@/components/admin/AdminHeader";
import AdminGuideManager from "@/components/admin/AdminGuideManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export const dynamic = "force-dynamic";

export default async function AdminGuidesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="guides"
          title="여행가이드 관리"
          description="랜딩 페이지/블로그용 여행가이드 카드를 등록하고 노출 상태를 관리하세요."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminGuideManager />
      </main>
    </div>
  );
}
