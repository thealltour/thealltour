/**
 * PR22: 공개 리뷰 selector 정리.
 * PR23: 개인화 리뷰 selector 추가.
 */
import { fromDbStatus } from "@/types/reviewModeration";
import {
  getSeoEligibleReviews,
  getSeoRepresentativeReviews,
  shouldExposeAggregateRating,
} from "@/lib/reviewSeoVisibility";
import { getPersonalizedReviews } from "@/lib/reviewPersonalization";
import type { ReviewForSeoEligibility } from "@/lib/reviewSeoVisibility";
import type { SeoEligibleReview } from "@/types/reviewSeo";
import type { ReviewPersonalizationContext } from "@/types/reviewPersonalization";
import type { PersonalizedReviewResult } from "@/types/reviewPersonalization";

/** status가 visible(submitted)인 리뷰만 */
export function getPublicVisibleReviews<T extends { status?: string }>(
  reviews: T[],
): T[] {
  return reviews.filter((r) => fromDbStatus(r.status) === "visible");
}

/** 대표 공개 리뷰 (정렬만, 상위 N개는 호출부에서 slice) */
export function getFeaturedPublicReviews<T extends ReviewForSeoEligibility>(
  reviews: T[],
  limit: number,
): T[] {
  const visible = getPublicVisibleReviews(reviews);
  return [...visible]
    .sort((a, b) => {
      const recA = a.recommendationScore ?? 0;
      const recB = b.recommendationScore ?? 0;
      if (recB !== recA) return recB - recA;
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    })
    .slice(0, limit);
}

export {
  getSeoEligibleReviews,
  getSeoRepresentativeReviews,
  shouldExposeAggregateRating,
};

export type { ReviewForSeoEligibility };

/** PR23: 공개 가능 리뷰만 개인화 점수 적용 후 상위 N개. hidden/flagged/under_review 제외, trustScore 낮으면 제외. */
export function getPersonalizedPublicReviews<T extends ReviewForPersonalizationInput>(
  reviews: T[],
  context: ReviewPersonalizationContext,
  limit = 5,
): { results: PersonalizedReviewResult[]; reviewsById: Map<string, T> } {
  const visible = getPublicVisibleReviews(reviews);
  const byId = new Map(visible.map((r) => [r.id, r]));
  const results = getPersonalizedReviews(visible as ReviewForPersonalizationInput[], context, limit);
  const reviewsById = new Map<string, T>();
  for (const r of results) {
    const rev = byId.get(r.reviewId);
    if (rev) reviewsById.set(r.reviewId, rev);
  }
  return { results, reviewsById };
}

type ReviewForPersonalizationInput = ReviewForSeoEligibility & {
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
};

/** SEO eligible 리뷰 기준 집계 통계 */
export function getAggregateReviewStats(
  reviews: ReviewForSeoEligibility[],
  options?: { minTrustScore?: number; minLength?: number },
): { averageRating: number; reviewCount: number } {
  const eligible = getSeoEligibleReviews(reviews, options);
  if (eligible.length === 0) return { averageRating: 0, reviewCount: 0 };
  const sum = eligible.reduce((s, r) => s + r.rating, 0);
  return {
    averageRating: Math.round((sum / eligible.length) * 10) / 10,
    reviewCount: eligible.length,
  };
}
