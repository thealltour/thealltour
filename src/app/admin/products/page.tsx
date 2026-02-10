import AdminHeader from "@/components/AdminHeader";
import AdminProductManager from "@/components/AdminProductManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminProductsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="products"
          title="상품 관리"
          description="상품 등록/수정과 함께 메인페이지 추천 슬라이드 노출 여부를 설정할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-white p-4 shadow-md ring-1 ring-[#dbeafe] md:p-5">
          <AdminProductManager />
        </section>
      </main>
    </div>
  );
}
