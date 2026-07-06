import AdminHeader from "@/components/admin/AdminHeader";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminMobileGolfAdForm from "@/components/admin/mobile-golf-ads/AdminMobileGolfAdForm";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminMobileGolfAdsNewPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-3xl space-y-6">
        <AdminHeader
          title="모바일 골프 랜딩 · 생성"
          description="Hero / Benefit / Trust&Action / 카카오 간편가입 CTA 구성"
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminToastProvider>
          <AdminMobileGolfAdForm mode="create" />
        </AdminToastProvider>
      </main>
    </div>
  );
}
