/**
 * PR23: 리뷰 개인화 규칙 상수 및 키워드 맵.
 */

import type { TravelCompanionType, TravelPreferenceTag } from "@/types/reviewPersonalization";

export const PERSONALIZATION_SCORE_WEIGHTS = {
  baseRecommendation: 0.45,
  trustScore: 0.25,
  preferenceMatch: 0.2,
} as const;

export const PREFERENCE_MATCH_MAX = 20;
export const CONTEXT_BOOST_MAX = 10;
export const RECENCY_BOOST_MAX = 8;
export const VERIFIED_BOOST = 5;
export const VERIFIED_PENALTY = 3;
export const MIN_PERSONALIZED_REVIEW_RATING = 1;
export const MIN_PERSONALIZED_TRUST_SCORE = 30;
export const TRUST_PENALTY_BELOW_50 = 15;

export const PREFERENCE_TAG_KEYWORD_MAP: Record<TravelPreferenceTag, string[]> = {
  comfort: ["편했", "쾌적", "편안", "편리", "이동 편함", "편하게"],
  value: ["가성비", "알찼", "가격 대비", "만족도", "알차"],
  food: ["맛집", "식사", "음식", "먹거리", "맛있"],
  nature: ["풍경", "자연", "바다", "산", "뷰", "전망"],
  activity: ["체험", "액티비티", "즐길거리", "다양한"],
  healing: ["힐링", "여유", "조용", "휴식", "편안"],
  schedule_efficiency: ["동선", "알찬 일정", "시간 효율", "빠듯하지 않음", "일정"],
  beginner_friendly: ["처음", "입문", "초보", "부담 없음", "편하게"],
  photospot: ["사진", "포토", "뷰", "인생샷", "촬영"],
  shopping: ["쇼핑", "구매", "시장", "면세", "기념품"],
};

export const COMPANION_TYPE_KEYWORD_MAP: Record<Exclude<TravelCompanionType, "unknown">, string[]> = {
  family: ["가족", "부모님", "아이", "어르신", "자녀", "가족여행"],
  couple: ["커플", "데이트", "신혼", "둘이", "연인"],
  friends: ["친구", "단체", "같이 놀기", "친구들", "동료"],
  solo: ["혼자", "1인", "혼행", "자유롭게", "솔로"],
  group: ["단체", "팀", "여럿", "여러 명", "단체여행"],
};

export const RECENCY_BOOST_RULES = {
  within14Days: 8,
  within30Days: 5,
  within90Days: 2,
} as const;

export const VERIFIED_PREFERENCE_RULES = {
  matchBonus: 5,
  mismatchPenalty: 3,
} as const;
