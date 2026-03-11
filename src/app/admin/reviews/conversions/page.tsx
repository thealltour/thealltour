import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { loadReviewConversionEvents } from "@/lib/reviewConversionDataLoader";
import { getReviewConversionAnalyticsData } from "@/lib/reviewConversionAnalytics";
import { compareVariantConversionLift } from "@/lib/reviewConversionComparisons";
import { ReviewConversionsDashboard } from "@/components/admin/reviews/ReviewConversionsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminReviewConversionsPage() {
  const [counts, unreadNotificationCount, events] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    loadReviewConversionEvents({ limit: 20000 }),
  ]);

  const data = getReviewConversionAnalyticsData(events, "last_review_touch");
  const variantLift = compareVariantConversionLift(data.variantSummaries);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 전환 기여도 분석"
          description="리뷰 노출·상호작용·요약/개인화가 상품 전환(CTA 클릭, 문의 등)에 기여한 정도를 확인할 수 있습니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewConversionsDashboard
            reviewSummaries={data.reviewSummaries}
            variantSummaries={data.variantSummaries}
            productSummaries={data.productSummaries}
            totalConversions={data.totalConversions}
            totalAttributedConversions={data.totalAttributedConversions}
            variantLift={variantLift}
            hasData={events.length > 0}
          />
        </section>
      </main>
    </div>
  );
}
