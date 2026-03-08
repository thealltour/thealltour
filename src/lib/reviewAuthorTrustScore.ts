/**
 * PR25: 작성자 단위 Trust Score 계산.
 * 0~100, 일관성·인증·참여 가산, 패턴 위험 감점.
 */
import type { ReviewAuthorPatternAnalysis } from "@/types/reviewAuthorProfile";

export type ReviewForAuthorTrust = {
  id: string;
  content?: string | null;
  rating?: number | null;
  eligibility_id?: string | null;
  helpfulCount?: number;
  created_at?: string | null;
  trustScore?: number;
};

const CONSISTENCY_MAX = 25;
const VERIFIED_MAX = 20;
const HELPFUL_MAX = 25;
const PENALTY_MAX = 40;

/**
 * 리뷰 수·평균 길이·평점 분포 등 일관성 기반 점수.
 */
export function calculateAuthorConsistencyScore(
  authorReviews: ReviewForAuthorTrust[],
): number {
  if (authorReviews.length === 0) return 0;
  let score = 0;
  if (authorReviews.length >= 5) score += 10;
  else if (authorReviews.length >= 2) score += 5;
  const withContent = authorReviews.filter((r) => ((r.content ?? "").trim().length ?? 0) >= 20);
  if (withContent.length >= authorReviews.length * 0.5) score += 10;
  const ratings = authorReviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);
  if (ratings.length >= 2) {
    const spread = Math.max(...ratings) - Math.min(...ratings);
    if (spread <= 2) score += 5;
  }
  return Math.min(CONSISTENCY_MAX, score);
}

/**
 * 인증 리뷰 비율 가산.
 */
export function calculateVerifiedBehaviorScore(
  authorReviews: ReviewForAuthorTrust[],
): number {
  if (authorReviews.length === 0) return 0;
  const verified = authorReviews.filter((r) => !!r.eligibility_id).length;
  const ratio = verified / authorReviews.length;
  if (ratio >= 0.8) return 20;
  if (ratio >= 0.5) return 15;
  if (ratio >= 0.2) return 10;
  if (verified >= 1) return 5;
  return 0;
}

/**
 * helpful 합계 기반 참여 점수.
 */
export function calculateHelpfulEngagementScore(
  authorReviews: ReviewForAuthorTrust[],
): number {
  const total = authorReviews.reduce((s, r) => s + (r.helpfulCount ?? 0), 0);
  if (total >= 50) return 25;
  if (total >= 20) return 20;
  if (total >= 10) return 15;
  if (total >= 3) return 10;
  if (total >= 1) return 5;
  return 0;
}

/**
 * 패턴 분석 결과에 따른 감점.
 */
export function calculateAuthorPatternPenalty(
  pattern: ReviewAuthorPatternAnalysis,
): number {
  let penalty = 0;
  if (pattern.hasExtremeBias) penalty += 12;
  if (pattern.hasDuplicatePattern) penalty += 12;
  if (pattern.hasBurstPattern) penalty += 8;
  if (pattern.hasLowQualityPattern) penalty += 8;
  if (pattern.hasLowTrustPattern) penalty += 10;
  return Math.min(PENALTY_MAX, penalty);
}

export function normalizeAuthorTrustScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * 작성자 Trust Score 계산.
 */
export function calculateAuthorTrustScore(
  authorReviews: ReviewForAuthorTrust[],
  patternAnalysis: ReviewAuthorPatternAnalysis,
): number {
  if (authorReviews.length === 0) return 50;
  const consistency = calculateAuthorConsistencyScore(authorReviews);
  const verified = calculateVerifiedBehaviorScore(authorReviews);
  const helpful = calculateHelpfulEngagementScore(authorReviews);
  const penalty = calculateAuthorPatternPenalty(patternAnalysis);
  const raw = consistency + verified + helpful - penalty;
  return normalizeAuthorTrustScore(raw);
}
