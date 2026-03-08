import AdminHeader from "@/components/AdminHeader";
import AdminReviewReportsTable from "@/components/admin/AdminReviewReportsTable";
import { getAdminCounts } from "@/lib/adminCounts";
import { getAdminReviewReports } from "@/lib/adminReviewReports";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminReviewReportsPage() {
  const [counts, unreadNotificationCount, reports] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getAdminReviewReports(),
  ]);

  const { inquiryCount, productCount, memberCount, reviewCount } = counts;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 신고 관리"
          description="접수된 리뷰 신고 목록입니다. 리뷰 숨김 또는 신고 무시를 할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminReviewReportsTable reports={reports} />
        </section>
      </main>
    </div>
  );
}
