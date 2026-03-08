/**
 * PR23: 리뷰 개인화 점수 계산.
 * 규칙 기반, 순수 함수. hidden/flagged/under_review 제외는 호출 전 selector에서 처리.
 */
import type {
  ReviewPersonalizationContext,
  PersonalizedReviewScore,
  PersonalizedReviewResult,
  TravelPreferenceTag,
  TravelCompanionType,
} from "@/types/reviewPersonalization";
import {
  PERSONALIZATION_SCORE_WEIGHTS,
  PREFERENCE_MATCH_MAX,
  CONTEXT_BOOST_MAX,
  RECENCY_BOOST_RULES,
  VERIFIED_PREFERENCE_RULES,
  MIN_PERSONALIZED_TRUST_SCORE,
  TRUST_PENALTY_BELOW_50,
} from "@/lib/reviewPersonalizationConstants";
import {
  PREFERENCE_TAG_KEYWORD_MAP,
  COMPANION_TYPE_KEYWORD_MAP,
} from "@/lib/reviewPersonalizationConstants";

export type ReviewForPersonalization = {
  id: string;
  content?: string;
  summary?: string;
  title?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating?: number;
  created_at?: string;
  eligibility_id?: string;
  helpfulCount?: number;
  recommendationScore?: number;
  trustScore?: number;
  status?: string;
};

function getReviewSearchText(review: ReviewForPersonalization): string {
  const parts = [
    review.content ?? "",
    review.summary ?? "",
    review.title ?? "",
    review.content_good ?? "",
    review.content_bad ?? "",
    review.content_tip ?? "",
  ];
  return parts.join(" ").toLowerCase().replace(/\s+/g, " ");
}

/** 리뷰 본문과 사용자 선호 태그 일치도. 0~PREFERENCE_MATCH_MAX */
export function scoreReviewPreferenceMatch(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
): number {
  const tags = context.preferenceTags ?? [];
  if (tags.length === 0) return 0;
  const text = getReviewSearchText(review);
  if (!text.length) return 0;
  let score = 0;
  const perTag = Math.min(PREFERENCE_MATCH_MAX / Math.max(1, tags.length), 8);
  for (const tag of tags) {
    const keywords = PREFERENCE_TAG_KEYWORD_MAP[tag as TravelPreferenceTag];
    if (!keywords) continue;
    const matched = keywords.some((kw) => text.includes(kw.toLowerCase()));
    if (matched) score += perTag;
  }
  return Math.min(PREFERENCE_MATCH_MAX, Math.round(score));
}

/** 동반 유형과 리뷰 내용 일치. contextBoostScore 일부 */
export function scoreCompanionTypeMatch(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
): number {
  const type = context.companionType;
  if (!type || type === "unknown") return 0;
  const keywords = COMPANION_TYPE_KEYWORD_MAP[type as Exclude<TravelCompanionType, "unknown">];
  if (!keywords) return 0;
  const text = getReviewSearchText(review);
  const matched = keywords.some((kw) => text.includes(kw.toLowerCase()));
  return matched ? Math.min(CONTEXT_BOOST_MAX, 6) : 0;
}

/** 최신 리뷰 선호 보정 */
export function scoreReviewRecency(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
): number {
  if (!context.prefersRecentReviews) return 0;
  const created = review.created_at;
  if (!created) return 0;
  const createdDate = new Date(created).getTime();
  const now = Date.now();
  const days = (now - createdDate) / (24 * 60 * 60 * 1000);
  if (days <= 14) return RECENCY_BOOST_RULES.within14Days;
  if (days <= 30) return RECENCY_BOOST_RULES.within30Days;
  if (days <= 90) return RECENCY_BOOST_RULES.within90Days;
  return 0;
}

/** 인증 리뷰 선호 보정 */
export function scoreVerifiedPreference(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
): number {
  if (!context.prefersVerifiedReviews) return 0;
  const verified = !!review.eligibility_id;
  return verified ? VERIFIED_PREFERENCE_RULES.matchBonus : -VERIFIED_PREFERENCE_RULES.mismatchPenalty;
}

function buildMatchedReasons(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
  prefScore: number,
  companionScore: number,
  recencyScore: number,
  verifiedScore: number,
): string[] {
  const reasons: string[] = [];
  if (prefScore > 0) reasons.push("preference_match");
  if (companionScore > 0) reasons.push("companion_match");
  if (recencyScore > 0) reasons.push("recent");
  if (verifiedScore > 0) reasons.push("verified");
  if (verifiedScore < 0) reasons.push("verified_mismatch");
  return reasons;
}

/**
 * 단일 리뷰 개인화 점수 계산.
 * finalPersonalizedScore = base*0.45 + trust*0.25 + preference*0.20 + contextBoost + recencyBoost + verifiedBoost
 * trustScore < MIN_PERSONALIZED_TRUST_SCORE 이면 강한 패널티 적용.
 */
export function calculatePersonalizedReviewScore(
  review: ReviewForPersonalization,
  context: ReviewPersonalizationContext,
): PersonalizedReviewScore {
  const baseRecommendationScore = Math.max(0, review.recommendationScore ?? 0);
  let trustScore = Math.max(0, Math.min(100, review.trustScore ?? 0));
  if (trustScore < MIN_PERSONALIZED_TRUST_SCORE) {
    trustScore = 0;
  } else if (trustScore < 50) {
    trustScore = Math.max(0, trustScore - TRUST_PENALTY_BELOW_50);
  }
  const preferenceMatchScore = scoreReviewPreferenceMatch(review, context);
  const contextBoostScore = scoreCompanionTypeMatch(review, context);
  const recencyBoostScore = scoreReviewRecency(review, context);
  const verifiedBoostScore = scoreVerifiedPreference(review, context);

  const raw =
    baseRecommendationScore * PERSONALIZATION_SCORE_WEIGHTS.baseRecommendation +
    (trustScore / 100) * (PERSONALIZATION_SCORE_WEIGHTS.trustScore * 100) +
    preferenceMatchScore * (PERSONALIZATION_SCORE_WEIGHTS.preferenceMatch / 100) * 100 +
    contextBoostScore +
    recencyBoostScore +
    verifiedBoostScore;
  const finalPersonalizedScore = Math.max(0, Math.min(100, Math.round(raw)));

  const matchedReasons = buildMatchedReasons(
    review,
    context,
    preferenceMatchScore,
    contextBoostScore,
    recencyBoostScore,
    verifiedBoostScore,
  );

  return {
    reviewId: review.id,
    baseRecommendationScore,
    trustScore: review.trustScore ?? 0,
    preferenceMatchScore,
    contextBoostScore,
    recencyBoostScore,
    verifiedBoostScore,
    finalPersonalizedScore,
    matchedReasons,
  };
}

/**
 * 리뷰 배열에 개인화 점수 부여 후 정렬해 상위 N개 반환.
 * 공개 가능 리뷰만 입력 가정. trustScore < MIN_PERSONALIZED_TRUST_SCORE 는 내부에서 제외.
 */
export function getPersonalizedReviews(
  reviews: ReviewForPersonalization[],
  context: ReviewPersonalizationContext,
  limit = 5,
): PersonalizedReviewResult[] {
  const minRating = context.minPreferredRating ?? 0;
  const scored = reviews
    .filter((r) => {
      if ((r.trustScore ?? 0) < MIN_PERSONALIZED_TRUST_SCORE) return false;
      const rating = r.rating ?? 0;
      if (minRating > 0 && rating < minRating) return false;
      return true;
    })
    .map((r) => calculatePersonalizedReviewScore(r, context))
    .filter((s) => s.finalPersonalizedScore >= 0)
    .sort((a, b) => {
      if (b.finalPersonalizedScore !== a.finalPersonalizedScore)
        return b.finalPersonalizedScore - a.finalPersonalizedScore;
      const aRec = reviews.find((r) => r.id === a.reviewId)?.recommendationScore ?? 0;
      const bRec = reviews.find((r) => r.id === b.reviewId)?.recommendationScore ?? 0;
      if (bRec !== aRec) return bRec - aRec;
      const aTrust = reviews.find((r) => r.id === a.reviewId)?.trustScore ?? 0;
      const bTrust = reviews.find((r) => r.id === b.reviewId)?.trustScore ?? 0;
      if (bTrust !== aTrust) return bTrust - aTrust;
      const aHelp = reviews.find((r) => r.id === a.reviewId)?.helpfulCount ?? 0;
      const bHelp = reviews.find((r) => r.id === b.reviewId)?.helpfulCount ?? 0;
      if (bHelp !== aHelp) return bHelp - aHelp;
      const aCreated = reviews.find((r) => r.id === a.reviewId)?.created_at ?? "";
      const bCreated = reviews.find((r) => r.id === b.reviewId)?.created_at ?? "";
      return bCreated.localeCompare(aCreated);
    });

  return scored.slice(0, limit).map((s) => ({
    reviewId: s.reviewId,
    personalizedScore: s.finalPersonalizedScore,
    matchedReasons: s.matchedReasons,
  }));
}

export function getDefaultPersonalizationContext(): ReviewPersonalizationContext {
  return {
    companionType: "unknown",
    preferenceTags: [],
    minPreferredRating: 4,
    prefersVerifiedReviews: true,
    prefersRecentReviews: false,
  };
}
