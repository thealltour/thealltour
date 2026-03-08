/**
 * PR21: 리뷰 Trust Score 계산.
 * 0~100 범위, quality + engagement + credibility - riskPenalty.
 */
import type { ReviewTrustScore } from "@/types/reviewTrust";

/** Trust 계산에 필요한 리뷰 필드 */
export type ReviewForTrust = {
  id: string;
  content?: string;
  title?: string;
  image_url?: string;
  image_urls?: string[];
  eligibility_id?: string;
  created_at?: string;
  rating?: number;
  helpfulCount?: number;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  summary?: string;
};

export type ReviewTrustContext = {
  /** 같은 사용자(작성자) 리뷰 수. >=3 이면 신뢰 가산 */
  authorReviewCount?: number;
  /** 같은 상품 내 동일/유사 문장 존재 시 true → risk 가산 */
  duplicateContentInProduct?: boolean;
  /** PR25: 작성자 단위 Trust Score (0~100). 있으면 리뷰 Trust 보조 반영 */
  authorTrustScore?: number;
};

const QUALITY_MAX = 40;
const ENGAGEMENT_MAX = 15;
const CREDIBILITY_MAX = 25;
const RISK_PENALTY_MAX = 30;

/**
 * 리뷰 길이 + 이미지 + 구조화 내용.
 * 최대 40점.
 */
export function calculateQualityScore(review: ReviewForTrust): number {
  const text = [
    (review.content ?? "").trim(),
    (review.title ?? "").trim(),
    (review.summary ?? "").trim(),
    (review.content_good ?? "").trim(),
    (review.content_bad ?? "").trim(),
    (review.content_tip ?? "").trim(),
  ].join(" ");
  const len = text.length;

  let lengthScore = 5;
  if (len >= 200) lengthScore = 25;
  else if (len >= 80) lengthScore = 20;
  else if (len >= 20) lengthScore = 10;

  const hasImages =
    (review.image_urls && review.image_urls.length > 0) ||
    !!(review.image_url && String(review.image_url).trim());
  const imageScore = hasImages ? 10 : 0;

  const hasStructured =
    (review.content ?? "").includes("\n") ||
    (review.content_good ?? "").trim().length >= 15 ||
    (review.content_bad ?? "").trim().length >= 15 ||
    (review.content_tip ?? "").trim().length >= 15 ||
    ((review.summary ?? "").trim().length >= 20);
  const structuredScore = hasStructured ? 5 : 0;

  return Math.min(QUALITY_MAX, lengthScore + imageScore + structuredScore);
}

/**
 * helpful_count 기반. 최대 15점.
 */
export function calculateEngagementScore(review: ReviewForTrust): number {
  const h = review.helpfulCount ?? 0;
  if (h >= 11) return 15;
  if (h >= 4) return 10;
  if (h >= 1) return 5;
  return 0;
}

/**
 * 인증 + 작성자 히스토리 + 작성 시점 안정성. 최대 25점.
 */
export function calculateCredibilityScore(
  review: ReviewForTrust,
  context?: ReviewTrustContext,
): number {
  let score = 0;
  if (review.eligibility_id) score += 15;
  if ((context?.authorReviewCount ?? 0) >= 3) score += 5;
  const daysSince = getDaysSinceCreated(review.created_at);
  if (daysSince > 7) score += 5;
  return Math.min(CREDIBILITY_MAX, score);
}

function getDaysSinceCreated(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  const d = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - d) / (24 * 60 * 60 * 1000);
}

/**
 * 스팸/극단/복제/비정상 패턴. 최대 -30 (0으로 클램프).
 */
export function calculateRiskPenalty(
  review: ReviewForTrust,
  context?: ReviewTrustContext,
): number {
  let penalty = 0;
  const content = (review.content ?? "").trim();
  const contentLen = content.length;
  const rating = review.rating ?? 0;
  const helpfulCount = review.helpfulCount ?? 0;
  const daysSince = getDaysSinceCreated(review.created_at);

  // 극단 평점 + 내용 짧음
  if ((rating === 1 || rating === 5) && contentLen < 20) {
    penalty += 10;
  }

  // 같은 상품 동일 문장
  if (context?.duplicateContentInProduct) {
    penalty += 15;
  }

  // 짧은 기간 높은 helpful
  if (daysSince <= 3 && helpfulCount >= 10) {
    penalty += 10;
  }

  // 스팸 의심: 매우 짧은 + 극단 평점
  if (contentLen < 10 && (rating === 1 || rating === 5)) {
    penalty += 10;
  }

  return Math.min(RISK_PENALTY_MAX, penalty);
}

export function normalizeTrustScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** 정규화된 본문으로 동일 상품 내 중복 여부 판단 (PR19/PR17 스타일) */
function normalizeContentForDuplicate(content: string | undefined): string {
  if (!content || typeof content !== "string") return "";
  return content
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/g, "")
    .trim();
}

/**
 * 리뷰 배열에 Trust Score 부여. 같은 상품 내 복제 여부는 배열 기준으로 계산.
 */
export function addTrustScoresToReviews<T extends ReviewForTrust>(
  reviews: T[],
): (T & { trustScore: number })[] {
  const byProduct = new Map<string, T[]>();
  for (const r of reviews) {
    const pid = (r as { product_id?: string }).product_id?.trim();
    if (pid) {
      const list = byProduct.get(pid) ?? [];
      list.push(r);
      byProduct.set(pid, list);
    }
  }
  const duplicateByReviewId = new Map<string, boolean>();
  for (const [, list] of byProduct) {
    const normCount = new Map<string, number>();
    for (const r of list) {
      const n = normalizeContentForDuplicate(r.content);
      if (n.length >= 10) normCount.set(n, (normCount.get(n) ?? 0) + 1);
    }
    for (const r of list) {
      const n = normalizeContentForDuplicate(r.content);
      duplicateByReviewId.set(r.id, n.length >= 10 && (normCount.get(n) ?? 0) >= 2);
    }
  }
  return reviews.map((r) => {
    const trust = calculateReviewTrustScore(r, {
      duplicateContentInProduct: duplicateByReviewId.get(r.id) ?? false,
    });
    return { ...r, trustScore: trust.trustScore };
  });
}

/**
 * 최종 Trust Score 계산.
 * trustScore = quality + engagement + credibility - riskPenalty + authorAdjustment, 0~100 클램프.
 * PR25: authorTrustScore 있으면 보조 반영 (80+ → +5, 60~79 → +2, 40~59 → 0, <40 → -8).
 */
export function calculateReviewTrustScore(
  review: ReviewForTrust,
  context?: ReviewTrustContext,
): ReviewTrustScore {
  const qualityScore = calculateQualityScore(review);
  const engagementScore = calculateEngagementScore(review);
  const credibilityScore = calculateCredibilityScore(review, context);
  const riskPenalty = calculateRiskPenalty(review, context);
  let raw = qualityScore + engagementScore + credibilityScore - riskPenalty;

  const authorTrust = context?.authorTrustScore;
  if (typeof authorTrust === "number") {
    if (authorTrust >= 80) raw += 5;
    else if (authorTrust >= 60) raw += 2;
    else if (authorTrust < 40) raw -= 8;
  }

  const trustScore = normalizeTrustScore(raw);

  return {
    reviewId: review.id,
    trustScore,
    qualityScore,
    engagementScore,
    credibilityScore,
    riskPenalty,
  };
}
