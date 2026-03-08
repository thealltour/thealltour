import AdminHeader from "@/components/AdminHeader";
import { getAllReviewsForAnalytics } from "@/lib/reviewAnalytics";
import { detectReviewAnomalies } from "@/lib/reviewAnomalyDetection";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { ReviewAnomaliesDashboard } from "@/components/admin/reviews/ReviewAnomaliesDashboard";

export default async function AdminReviewAnomaliesPage() {
  const [counts, unreadNotificationCount, reviews] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getAllReviewsForAnalytics(),
  ]);

  const anomalies = detectReviewAnomalies(reviews);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 이상 감지"
          description="평점 급락, 리뷰 급증, 스팸 의심 리뷰 등 이상 징후를 확인합니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          {reviews.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              리뷰 데이터가 없어 이상 감지를 수행할 수 없습니다.
            </p>
          ) : (
            <ReviewAnomaliesDashboard anomalies={anomalies} />
          )}
        </section>
      </main>
    </div>
  );
}
