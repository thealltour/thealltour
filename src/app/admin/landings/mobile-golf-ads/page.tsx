import AdminHeader from "@/components/admin/AdminHeader";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import AdminMobileGolfAdManager from "@/components/admin/mobile-golf-ads/AdminMobileGolfAdManager";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminMobileGolfAdsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="랜딩·유입 · 모바일 골프 랜딩"
          description="카카오 비즈보드용 모바일 골프 랜딩을 생성하고 URL을 발행합니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminToastProvider>
          <AdminConfirmProvider>
            <AdminMobileGolfAdManager />
          </AdminConfirmProvider>
        </AdminToastProvider>
      </main>
    </div>
  );
}
