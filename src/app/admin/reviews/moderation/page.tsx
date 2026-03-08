import AdminHeader from "@/components/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getReviewsForModeration } from "@/lib/reviewModeration";
import { buildReviewModerationQueue } from "@/lib/reviewModerationQueue";
import { getReviewReportSummariesBatch } from "@/lib/reviewReports";
import { buildReviewAuthorProfiles } from "@/lib/reviewAuthorProfiles";
import { getReviewAuthorKey } from "@/lib/reviewAuthorIdentity";
import { getAuthorProfileMap } from "@/lib/reviewAuthorSelectors";
import { ReviewModerationDashboard } from "@/components/admin/reviews/ReviewModerationDashboard";

export const dynamic = "force-dynamic";

export default async function AdminReviewModerationPage() {
  const [counts, unreadNotificationCount, reviews] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getReviewsForModeration(),
  ]);

  const profiles = buildReviewAuthorProfiles(reviews);
  const profileByAuthorKey = getAuthorProfileMap(profiles);
  const authorProfileByReviewId: Record<
    string,
    { authorRiskLevel: "low" | "medium" | "high"; authorTrustScore: number; authorReviewCount: number }
  > = {};
  for (const r of reviews) {
    const key = getReviewAuthorKey(r);
    const profile = profileByAuthorKey.get(key);
    if (profile) {
      authorProfileByReviewId[r.id] = {
        authorRiskLevel: profile.authorRiskLevel,
        authorTrustScore: profile.authorTrustScore,
        authorReviewCount: profile.totalReviews,
      };
    }
  }

  const queueItems = buildReviewModerationQueue(
    reviews.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      status: r.status,
      report_count: r.report_count,
      created_at: r.created_at,
      authorRiskLevel: authorProfileByReviewId[r.id]?.authorRiskLevel,
    })),
  );
  const reportSummaries = await getReviewReportSummariesBatch(reviews.map((r) => r.id));
  const highPriorityCount = queueItems.filter((q) => q.priorityLevel === "high").length;
  const flaggedCount = reviews.filter((r) => r.status === "flagged" || (r.report_count ?? 0) >= 3).length;
  const hiddenCount = reviews.filter((r) => r.status === "hidden").length;
  const recentReportsCount = [...reportSummaries.values()].reduce((acc, s) => acc + s.totalReports, 0);

  const summary = {
    pendingCount: reviews.length,
    highPriorityCount,
    flaggedCount,
    hiddenCount,
    recentReportsCount,
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 검토"
          description="검토 대기·신고된 리뷰·숨김 리뷰를 관리하고, 숨김/복원/검토/해결 처리할 수 있습니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewModerationDashboard
            reviews={reviews}
            queueItems={queueItems}
            reportSummaries={Object.fromEntries(reportSummaries)}
            summary={summary}
            authorProfileByReviewId={authorProfileByReviewId}
          />
        </section>
      </main>
    </div>
  );
}
