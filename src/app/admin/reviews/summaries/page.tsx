import AdminHeader from "@/components/admin/AdminHeader";
import { getAllReviewsForAnalytics } from "@/lib/reviewAnalytics";
import { buildProductReviewSummaries } from "@/lib/reviewSummaryBuilder";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { ReviewSummariesDashboard } from "@/components/admin/reviews/ReviewSummariesDashboard";

export default async function AdminReviewSummariesPage() {
  const [counts, unreadNotificationCount, reviews] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getAllReviewsForAnalytics(),
  ]);

  const summaries = buildProductReviewSummaries(reviews);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 요약 (관리자)"
          description="상품별 리뷰 구조화 요약을 확인합니다. 장점/단점/추천대상/키워드 등."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          {reviews.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              리뷰 데이터가 없어 요약을 생성할 수 없습니다.
            </p>
          ) : (
            <ReviewSummariesDashboard summaries={summaries} />
          )}
        </section>
      </main>
    </div>
  );
}
