import AdminHeader from "@/components/admin/AdminHeader";
import { getAllReviewsForAnalytics, computeReviewAnalytics } from "@/lib/reviewAnalytics";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { ReviewAnalyticsDashboard } from "@/components/admin/reviews/ReviewAnalyticsDashboard";

export default async function AdminReviewAnalyticsPage() {
  const [counts, unreadNotificationCount, reviews] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getAllReviewsForAnalytics(),
  ]);

  const analytics = computeReviewAnalytics(reviews);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 분석"
          description="상품별 리뷰 품질·상태·추천 점수를 한눈에 확인합니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewAnalyticsDashboard analytics={analytics} />
        </section>
      </main>
    </div>
  );
}
