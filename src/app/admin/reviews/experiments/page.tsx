import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getReviewExperimentEventsSummary, compareExperimentVariants } from "@/lib/reviewExperimentAnalytics";
import { ReviewExperimentsDashboard } from "@/components/admin/reviews/ReviewExperimentsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminReviewExperimentsPage() {
  const [counts, unreadNotificationCount, summaries] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getReviewExperimentEventsSummary({ limit: 10000 }),
  ]);

  const withLift = compareExperimentVariants(summaries);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 A/B 실험"
          description="리뷰 노출 variant별 노출·클릭·전환 성과를 비교할 수 있습니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewExperimentsDashboard summaries={withLift} />
        </section>
      </main>
    </div>
  );
}
