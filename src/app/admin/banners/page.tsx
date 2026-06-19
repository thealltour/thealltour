import AdminBannerManager from "@/components/admin/AdminBannerManager";
import AdminHeroContentForm from "@/components/admin/AdminHeroContentForm";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminBannersPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="메인 배너 관리"
          description="메인페이지 최상단 배너를 추가/삭제하고 노출 상태를 관리합니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
          <AdminToastProvider>
            <AdminConfirmProvider>
              <div className="space-y-6">
                <AdminHeroContentForm />
                <AdminBannerManager />
              </div>
            </AdminConfirmProvider>
          </AdminToastProvider>
        </section>
      </main>
    </div>
  );
}
