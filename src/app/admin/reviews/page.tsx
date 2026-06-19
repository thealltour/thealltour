import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getAllReviewsForAdminList } from "@/lib/reviewAdminList";
import { AdminReviewListPage } from "@/components/admin/reviews/AdminReviewListPage";

export default async function AdminReviewsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount, reviews] =
    await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
      getAllReviewsForAdminList(),
    ]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="후기 관리"
          description="리뷰 검색·필터·정렬로 목록을 확인하고, analytics / anomalies / summaries로 이동할 수 있습니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminReviewListPage reviews={reviews} />
        </section>
      </main>
    </div>
  );
}
