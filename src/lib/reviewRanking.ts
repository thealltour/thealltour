/**
 * PR15: 리뷰 추천 점수(recommendation score) 계산 및 정렬.
 * - helpfulCount 비중 최대, verified·rating·freshness·품질 보조.
 * - PR21: Trust Score 반영 (baseScore + trustScore * 0.3).
 */
import type { PublicReviewItem } from "@/types/review";
import { calculateReviewTrustScore } from "@/lib/reviewTrustScore";

/** 점수 계산에 사용하는 리뷰 필드만 있는 타입 (PublicReviewItem 호환) */
export type ReviewForScore = Pick<
  PublicReviewItem,
  | "id"
  | "helpfulCount"
  | "rating"
  | "created_at"
  | "eligibility_id"
  | "image_url"
  | "image_urls"
  | "summary"
  | "content"
  | "content_good"
  | "content_bad"
  | "content_tip"
>;

export type RankingSignals = {
  helpfulCount: number;
  verified: boolean;
  hasImages: boolean;
  hasStructuredContent: boolean;
  freshnessBucket: "30d" | "90d" | "180d" | "older";
};

export type ExplainReviewScoreResult = {
  helpful: number;
  verified: number;
  rating: number;
  images: number;
  structured: number;
  freshness: number;
  total: number;
  signals?: RankingSignals;
};

/** 1차 버전 가중치 (운영 조정 가능) */
const WEIGHTS = {
  helpfulPerVote: 5,
  verifiedBonus: 15,
  ratingPerPoint: 2,
  hasImagesBonus: 3,
  hasStructuredBonus: 4,
  freshness30d: 6,
  freshness90d: 3,
  freshness180d: 1,
  freshnessOlder: 0,
} as const;

/** 구조화 리뷰: summary 또는 content_good/bad/tip 중 하나라도 충분한 길이 */
function hasStructuredContent(review: ReviewForScore): boolean {
  const s = (review.summary ?? "").trim();
  if (s.length >= 20) return true;
  const good = (review.content_good ?? "").trim();
  const bad = (review.content_bad ?? "").trim();
  const tip = (review.content_tip ?? "").trim();
  return good.length >= 15 || bad.length >= 15 || tip.length >= 15;
}

/** 이미지 포함 여부 */
function hasImages(review: ReviewForScore): boolean {
  const urls = review.image_urls ?? [];
  if (urls.length > 0) return true;
  return !!(review.image_url && String(review.image_url).trim());
}

/** 작성일 기준 신선도 버킷 (일) */
function getFreshnessBucket(createdAt: string | undefined): "30d" | "90d" | "180d" | "older" {
  if (!createdAt) return "older";
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const days = (now - created) / (24 * 60 * 60 * 1000);
  if (days <= 30) return "30d";
  if (days <= 90) return "90d";
  if (days <= 180) return "180d";
  return "older";
}

/** 신선도 가산점 수치 */
function getFreshnessBonus(bucket: "30d" | "90d" | "180d" | "older"): number {
  switch (bucket) {
    case "30d":
      return WEIGHTS.freshness30d;
    case "90d":
      return WEIGHTS.freshness90d;
    case "180d":
      return WEIGHTS.freshness180d;
    default:
      return WEIGHTS.freshnessOlder;
  }
}

/**
 * 리뷰 1건의 추천 점수 계산.
 * 공개 리뷰(set)에 대해서만 호출. hidden/draft는 이미 제외된 상태를 가정.
 * PR21: baseScore + trustScore * 0.3 반영.
 * PR25: authorTrustScore 옵션 시 약한 보조 가산 (authorTrustScore * 0.05, 최대 5).
 */
export function calculateReviewScore(
  review: ReviewForScore,
  options?: { now?: number; authorTrustScore?: number },
): number {
  const helpful = (review.helpfulCount ?? 0) * WEIGHTS.helpfulPerVote;
  const verified = review.eligibility_id ? WEIGHTS.verifiedBonus : 0;
  const rating = (review.rating ?? 0) * WEIGHTS.ratingPerPoint;
  const images = hasImages(review) ? WEIGHTS.hasImagesBonus : 0;
  const structured = hasStructuredContent(review) ? WEIGHTS.hasStructuredBonus : 0;
  const bucket = getFreshnessBucket(review.created_at);
  const freshness = getFreshnessBonus(bucket);
  const baseScore = helpful + verified + rating + images + structured + freshness;
  const trust = calculateReviewTrustScore(review, {});
  let total = baseScore + trust.trustScore * 0.3;
  const authorTrust = options?.authorTrustScore;
  if (typeof authorTrust === "number" && authorTrust >= 0 && authorTrust <= 100) {
    total += Math.min(5, authorTrust * 0.05);
  }
  return total;
}

/**
 * 디버깅/운영용: 점수 구성 요소 반환.
 */
export function explainReviewScore(review: ReviewForScore): ExplainReviewScoreResult {
  const helpful = (review.helpfulCount ?? 0) * WEIGHTS.helpfulPerVote;
  const verified = review.eligibility_id ? WEIGHTS.verifiedBonus : 0;
  const rating = (review.rating ?? 0) * WEIGHTS.ratingPerPoint;
  const images = hasImages(review) ? WEIGHTS.hasImagesBonus : 0;
  const structured = hasStructuredContent(review) ? WEIGHTS.hasStructuredBonus : 0;
  const bucket = getFreshnessBucket(review.created_at);
  const freshness = getFreshnessBonus(bucket);
  const total = helpful + verified + rating + images + structured + freshness;
  return {
    helpful,
    verified,
    rating,
    images,
    structured,
    freshness,
    total,
    signals: {
      helpfulCount: review.helpfulCount ?? 0,
      verified: !!review.eligibility_id,
      hasImages: hasImages(review),
      hasStructuredContent: hasStructuredContent(review),
      freshnessBucket: bucket,
    },
  };
}

/**
 * 추천순 정렬: recommendationScore DESC → helpfulCount DESC → rating DESC → created_at DESC.
 * 항목에 recommendationScore를 부여한 뒤 정렬 (호출 측에서 반환용으로 사용).
 */
export function sortReviewsByRecommendation<T extends ReviewForScore>(
  reviews: T[],
): (T & { recommendationScore: number })[] {
  const withScore = reviews.map((r) => ({
    ...r,
    recommendationScore: calculateReviewScore(r),
  }));
  withScore.sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    const aHelp = a.helpfulCount ?? 0;
    const bHelp = b.helpfulCount ?? 0;
    if (bHelp !== aHelp) return bHelp - aHelp;
    const aRate = a.rating ?? 0;
    const bRate = b.rating ?? 0;
    if (bRate !== aRate) return bRate - aRate;
    const aDate = a.created_at ?? "";
    const bDate = b.created_at ?? "";
    return bDate.localeCompare(aDate);
  });
  return withScore;
}
