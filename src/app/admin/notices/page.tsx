import AdminHeader from "@/components/AdminHeader";
import AdminNoticeManager from "@/components/AdminNoticeManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminNoticesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="notices"
          title="공지사항 관리"
          description="고객센터 공지사항을 작성하고 수정할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />
        <section className="overflow-hidden rounded-2xl bg-white p-4 shadow-md ring-1 ring-[#dbeafe] md:p-5">
          <AdminNoticeManager />
        </section>
      </main>
    </div>
  );
}
