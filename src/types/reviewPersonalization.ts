/**
 * PR23: 리뷰 개인화 추천 타입.
 */

export type TravelCompanionType =
  | "solo"
  | "couple"
  | "family"
  | "friends"
  | "group"
  | "unknown";

export type TravelPreferenceTag =
  | "comfort"
  | "value"
  | "photospot"
  | "food"
  | "shopping"
  | "nature"
  | "activity"
  | "healing"
  | "schedule_efficiency"
  | "beginner_friendly";

export interface ReviewPersonalizationContext {
  companionType?: TravelCompanionType;
  preferenceTags?: TravelPreferenceTag[];
  minPreferredRating?: number;
  prefersVerifiedReviews?: boolean;
  prefersRecentReviews?: boolean;
}

export interface PersonalizedReviewScore {
  reviewId: string;
  baseRecommendationScore: number;
  trustScore: number;
  preferenceMatchScore: number;
  contextBoostScore: number;
  recencyBoostScore: number;
  verifiedBoostScore: number;
  finalPersonalizedScore: number;
  matchedReasons: string[];
}

export interface PersonalizedReviewResult {
  reviewId: string;
  personalizedScore: number;
  matchedReasons: string[];
}

export type PersonalizedReviewSection = {
  title: string;
  reviews: PersonalizedReviewResult[];
};

export type PersonalizedReviewSummary = {
  totalCount: number;
  topReviews: PersonalizedReviewResult[];
};

/** 선호 태그 → 리뷰 본문 키워드 매핑 (내부용) */
export type ReviewPreferenceKeywordMap = Partial<Record<TravelPreferenceTag, string[]>>;
