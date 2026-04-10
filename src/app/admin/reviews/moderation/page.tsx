import { ReviewModerationPageBody } from "@/components/admin/reviews/ReviewModerationPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getReviewsForModeration } from "@/lib/reviewModeration";
import { buildReviewModerationQueue } from "@/lib/reviewModerationQueue";
import { getReviewReportSummariesBatch } from "@/lib/reviewReports";
import { buildReviewAuthorProfiles } from "@/lib/reviewAuthorProfiles";
import { getReviewAuthorKey } from "@/lib/reviewAuthorIdentity";
import { getAuthorProfileMap } from "@/lib/reviewAuthorSelectors";

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
    <ReviewModerationPageBody
      inquiryCount={counts.inquiryCount}
      productCount={counts.productCount}
      memberCount={counts.memberCount}
      reviewCount={counts.reviewCount}
      unreadNotificationCount={unreadNotificationCount}
      moderation={{
        reviews,
        queueItems,
        reportSummaries: Object.fromEntries(reportSummaries),
        summary,
        authorProfileByReviewId,
      }}
    />
  );
}
