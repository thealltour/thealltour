/**
 * PR23: 개인화 사유를 사용자용 자연어 라벨로 변환.
 */
import type {
  PersonalizedReviewScore,
  PersonalizedReviewResult,
  ReviewPersonalizationContext,
  TravelPreferenceTag,
  TravelCompanionType,
} from "@/types/reviewPersonalization";

const PREFERENCE_LABELS: Record<TravelPreferenceTag, string> = {
  comfort: "편의·쾌적",
  value: "가성비",
  photospot: "포토·뷰",
  food: "맛집·음식",
  shopping: "쇼핑",
  nature: "자연·풍경",
  activity: "액티비티·체험",
  healing: "힐링·휴식",
  schedule_efficiency: "일정·동선",
  beginner_friendly: "초보·입문",
};

const COMPANION_LABELS: Record<Exclude<TravelCompanionType, "unknown">, string> = {
  solo: "혼자 여행",
  couple: "커플·데이트",
  family: "가족 여행",
  friends: "친구와 함께",
  group: "단체 여행",
};

export function humanizePreferenceTag(tag: TravelPreferenceTag): string {
  return PREFERENCE_LABELS[tag] ?? tag;
}

export function humanizeCompanionType(type: Exclude<TravelCompanionType, "unknown">): string {
  return COMPANION_LABELS[type] ?? type;
}

const REASON_TO_LABEL: Record<string, string> = {
  preference_match: "선호 키워드와 잘 맞는 후기",
  companion_match: "동행 유형에 맞는 후기",
  recent: "최근 작성된 후기",
  verified: "인증된 여행 후기",
  verified_mismatch: "인증 후기 선호 시 참고",
};

export function getMatchedReasonLabels(
  scoreResult: PersonalizedReviewScore | PersonalizedReviewResult,
  _context?: ReviewPersonalizationContext,
): string[] {
  const reasons = scoreResult.matchedReasons;
  const labels: string[] = [];
  for (const r of reasons) {
    const label = REASON_TO_LABEL[r];
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (labels.length === 0) labels.push("많이 도움이 된 후기");
  return labels;
}

/** 컨텍스트 기반 섹션 제목 제안 */
export function getPersonalizedSectionTitle(
  context: ReviewPersonalizationContext,
  fallback = "추천 리뷰",
): string {
  if (context.companionType && context.companionType !== "unknown") {
    const label = COMPANION_LABELS[context.companionType as Exclude<TravelCompanionType, "unknown">];
    if (label) return `${label}에 잘 맞는 후기`;
  }
  if (context.preferenceTags?.length) {
    const first = context.preferenceTags[0];
    const tagLabel = PREFERENCE_LABELS[first as TravelPreferenceTag];
    if (tagLabel) return `${tagLabel} 관점에서 참고하기 좋은 후기`;
  }
  if (context.prefersVerifiedReviews) return "인증된 여행 후기";
  if (context.prefersRecentReviews) return "최근 작성된 후기";
  return fallback;
}
