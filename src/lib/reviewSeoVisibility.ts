/**
 * PR22: 공개 리뷰 중 SEO 구조화 데이터에 포함 가능한 리뷰만 선별.
 * status visible, trustScore, content 길이, rating 유효 범위 기준.
 */
import {
  MIN_SEO_REVIEW_LENGTH,
  MIN_SEO_TRUST_SCORE,
  MAX_SEO_REPRESENTATIVE_REVIEWS,
  MIN_SEO_AGGREGATE_REVIEW_COUNT,
} from "@/lib/reviewSeoConstants";
import { fromDbStatus } from "@/types/reviewModeration";
import type { SeoEligibleReview } from "@/types/reviewSeo";

/** SEO 선별 입력용 리뷰 (공개 페이지/관리자 목록 타입 호환) */
export type ReviewForSeoEligibility = {
  id: string;
  content?: string;
  rating?: number;
  status?: string;
  trustScore?: number;
  helpfulCount?: number;
  created_at?: string;
  recommendationScore?: number;
  product_id?: string | null;
  author_name?: string;
  title?: string;
  summary?: string;
  eligibility_id?: string;
};

function isVisible(status: string | undefined): boolean {
  if (status == null) return true;
  const s = fromDbStatus(status);
  return s === "visible";
}

/**
 * SEO 구조화 데이터에 포함 가능한 리뷰만 선별.
 * - status === visible (또는 submitted)
 * - trustScore >= MIN_SEO_TRUST_SCORE (없으면 제외하거나 통과: 보수적으로 없으면 제외)
 * - content.trim().length >= MIN_SEO_REVIEW_LENGTH
 * - rating 1~5 유효
 */
export function getSeoEligibleReviews(
  reviews: ReviewForSeoEligibility[],
  options?: { minTrustScore?: number; minLength?: number },
): SeoEligibleReview[] {
  const minTrust = options?.minTrustScore ?? MIN_SEO_TRUST_SCORE;
  const minLen = options?.minLength ?? MIN_SEO_REVIEW_LENGTH;

  return reviews
    .filter((r) => {
      if (!isVisible(r.status)) return false;
      const content = (r.content ?? "").trim();
      if (content.length < minLen) return false;
      const rating = r.rating ?? 0;
      if (rating < 1 || rating > 5) return false;
      const trust = r.trustScore;
      if (trust != null && trust < minTrust) return false;
      return true;
    })
    .map((r) => ({
      id: r.id,
      productId: r.product_id ?? undefined,
      product_id: r.product_id,
      rating: Math.round(r.rating!) as number,
      content: (r.content ?? "").trim(),
      helpfulCount: r.helpfulCount ?? 0,
      verified: !!r.eligibility_id,
      createdAt: r.created_at ?? "",
      recommendationScore: r.recommendationScore,
      trustScore: r.trustScore,
      status: "visible" as const,
      author_name: r.author_name,
      title: r.title,
      summary: r.summary,
    }));
}

/**
 * SEO용 대표 리뷰 1~3개 선택.
 * getSeoEligibleReviews 통과 리뷰 기준,
 * recommendationScore DESC → trustScore DESC → helpfulCount DESC → created_at DESC.
 */
export function getSeoRepresentativeReviews(
  reviews: ReviewForSeoEligibility[],
  limit = MAX_SEO_REPRESENTATIVE_REVIEWS,
  options?: { minTrustScore?: number; minLength?: number },
): SeoEligibleReview[] {
  const eligible = getSeoEligibleReviews(reviews, options);
  return [...eligible]
    .sort((a, b) => {
      const recA = a.recommendationScore ?? 0;
      const recB = b.recommendationScore ?? 0;
      if (recB !== recA) return recB - recA;
      const trustA = a.trustScore ?? 0;
      const trustB = b.trustScore ?? 0;
      if (trustB !== trustA) return trustB - trustA;
      const helpA = a.helpfulCount ?? 0;
      const helpB = b.helpfulCount ?? 0;
      if (helpB !== helpA) return helpB - helpA;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    })
    .slice(0, limit);
}

/**
 * AggregateRating schema 노출 여부.
 * SEO eligible 리뷰 수 >= MIN_SEO_AGGREGATE_REVIEW_COUNT 이면 true.
 */
export function shouldExposeAggregateRating(
  reviews: ReviewForSeoEligibility[],
  options?: { minCount?: number; minTrustScore?: number; minLength?: number },
): boolean {
  const minCount = options?.minCount ?? MIN_SEO_AGGREGATE_REVIEW_COUNT;
  const eligible = getSeoEligibleReviews(reviews, options);
  return eligible.length >= minCount;
}
