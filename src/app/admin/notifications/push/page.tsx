import AdminHeader from "@/components/admin/AdminHeader";
import { AdminPushNotificationSettings } from "@/components/admin/pwa/AdminPushNotificationSettings";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminNotificationsPushPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          title="OS 푸시 알림"
          description="관리자 PWA에서 OS 알림을 받도록 설정합니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-6">
          <AdminPushNotificationSettings />
        </section>
      </main>
    </div>
  );
}
