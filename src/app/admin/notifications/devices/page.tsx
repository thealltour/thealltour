import AdminHeader from "@/components/admin/AdminHeader";
import { AdminLoggedDevicesSettings } from "@/components/admin/pwa/AdminLoggedDevicesSettings";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminNotificationsDevicesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          title="로그인된 기기"
          description="관리자 계정으로 로그인된 기기를 확인하고 원격 로그아웃할 수 있습니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-6">
          <AdminLoggedDevicesSettings />
        </section>
      </main>
    </div>
  );
}
