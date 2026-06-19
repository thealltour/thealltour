import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getAllReviewsForAnalytics } from "@/lib/reviewAnalytics";
import { addTrustScoresToReviews } from "@/lib/reviewTrustScore";
import { detectReviewAnomalies } from "@/lib/reviewAnomalyDetection";
import { getReviewSummariesList } from "@/lib/reviewSummaries";
import { getReviewsForModeration } from "@/lib/reviewModeration";
import { loadReviewConversionEvents } from "@/lib/reviewConversionDataLoader";
import { getReviewConversionAnalyticsData } from "@/lib/reviewConversionAnalytics";
import { buildProductReviewInsightReports } from "@/lib/reviewProductInsights";
import type { ProductReviewSummaryLike } from "@/lib/reviewInsightSelectors";
import { ReviewProductInsightsDashboard } from "@/components/admin/reviews/ReviewProductInsightsDashboard";

export const dynamic = "force-dynamic";

const MAX_REVIEWS_INSIGHTS = 3000;

export default async function AdminReviewInsightsPage() {
  const [counts, unreadNotificationCount, allReviews, summariesRes, moderationReviews, conversionEvents] =
    await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
      getAllReviewsForAnalytics(),
      getReviewSummariesList({ limit: 500 }),
      getReviewsForModeration(),
      loadReviewConversionEvents({ limit: 15000 }),
    ]);

  const reviews = allReviews.slice(0, MAX_REVIEWS_INSIGHTS);
  const reviewsWithTrust = addTrustScoresToReviews(reviews);
  const anomalyResult = detectReviewAnomalies(
    reviewsWithTrust.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      rating: r.rating,
      helpfulCount: r.helpfulCount,
      eligibility_id: r.eligibility_id,
      created_at: r.created_at,
      content: r.content,
    })),
  );
  const conversionData = getReviewConversionAnalyticsData(conversionEvents, "last_review_touch");
  const summaries: ProductReviewSummaryLike[] = summariesRes.rows.map((s) => ({
    product_id: s.product_id,
    positive_points: s.positive_points,
    negative_points: s.negative_points,
    recommended_for: s.recommended_for,
    summary_text: s.summary_text,
    average_rating: s.average_rating,
    review_count: s.review_count,
  }));

  const reports = buildProductReviewInsightReports({
    reviews: reviewsWithTrust.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      rating: r.rating,
      content: r.content,
      content_good: r.content_good,
      content_bad: r.content_bad,
      content_tip: r.content_tip,
      summary: r.summary,
      helpfulCount: r.helpfulCount,
      eligibility_id: r.eligibility_id,
      created_at: r.created_at,
      recommendationScore: r.recommendationScore,
      trustScore: r.trustScore,
    })),
    summaries,
    anomalyResult,
    conversionProductSummaries: conversionData.productSummaries,
    moderationReviews: moderationReviews.map((r) => ({
      product_id: r.product_id,
      status: r.status,
      report_count: r.report_count,
    })),
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="리뷰 기반 상품 인사이트"
          description="리뷰·요약·이상감지·전환 데이터를 종합한 상품별 인사이트 리포트입니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              리뷰 데이터가 없어 인사이트 리포트를 생성할 수 없습니다.
            </p>
          ) : (
            <ReviewProductInsightsDashboard reports={reports} />
          )}
        </section>
      </main>
    </div>
  );
}
