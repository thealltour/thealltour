import AdminHeader from "@/components/AdminHeader";
import AdminReviewTable from "@/components/AdminReviewTable";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminReviewsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="후기 관리"
          description="등록된 여행후기 내용을 열람하고 제목/작성자/본문을 수정할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#dbeafe]">
          <AdminToastProvider>
            <AdminConfirmProvider>
              <AdminReviewTable />
            </AdminConfirmProvider>
          </AdminToastProvider>
        </section>
      </main>
    </div>
  );
}
