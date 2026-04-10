/**
 * 대시보드용 리뷰 moderation 요약 (moderation 페이지와 동일한 집계 규칙).
 */
import "server-only";

import { getReviewsForModeration } from "@/lib/reviewModeration";
import { buildReviewModerationQueue } from "@/lib/reviewModerationQueue";
import { buildReviewAuthorProfiles } from "@/lib/reviewAuthorProfiles";
import { getAuthorProfileMap } from "@/lib/reviewAuthorSelectors";
import { getReviewAuthorKey } from "@/lib/reviewAuthorIdentity";

export type AdminReviewModerationSummary = {
  pendingCount: number;
  highPriorityCount: number;
  flaggedCount: number;
  hiddenCount: number;
};

export async function getAdminReviewModerationSummary(): Promise<AdminReviewModerationSummary> {
  const reviews = await getReviewsForModeration();
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
  const highPriorityCount = queueItems.filter((q) => q.priorityLevel === "high").length;
  const flaggedCount = reviews.filter((r) => r.status === "flagged" || (r.report_count ?? 0) >= 3).length;
  const hiddenCount = reviews.filter((r) => r.status === "hidden").length;

  return {
    pendingCount: reviews.length,
    highPriorityCount,
    flaggedCount,
    hiddenCount,
  };
}
