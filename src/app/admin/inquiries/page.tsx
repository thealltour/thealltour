import AdminHeader from "@/components/AdminHeader";
import AdminInquiryTable from "@/components/AdminInquiryTable";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminInquiriesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="inquiries"
          title="문의 관리"
          description="접수된 문의를 검색하고 상담 완료 상태를 업데이트할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#dbeafe]">
          <AdminInquiryTable />
        </section>
      </main>
    </div>
  );
}
