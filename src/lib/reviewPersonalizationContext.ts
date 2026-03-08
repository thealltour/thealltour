/**
 * PR23: 개인화 컨텍스트 파싱 (query params 등).
 * searchParams와 쉽게 연결 가능한 구조.
 */
import type { ReviewPersonalizationContext } from "@/types/reviewPersonalization";
import type { TravelCompanionType, TravelPreferenceTag } from "@/types/reviewPersonalization";
import { getDefaultPersonalizationContext } from "@/lib/reviewPersonalization";

const COMPANION_PARAM_VALUES: Record<string, TravelCompanionType> = {
  solo: "solo",
  couple: "couple",
  family: "family",
  friends: "friends",
  group: "group",
  unknown: "unknown",
};

const PREF_PARAM_VALUES: Record<string, TravelPreferenceTag> = {
  comfort: "comfort",
  value: "value",
  photospot: "photospot",
  food: "food",
  shopping: "shopping",
  nature: "nature",
  activity: "activity",
  healing: "healing",
  schedule_efficiency: "schedule_efficiency",
  beginner_friendly: "beginner_friendly",
};

export type RawPersonalizationParams = {
  companion?: string;
  pref?: string;
  recent?: string;
  verified?: string;
  minRating?: string;
};

/**
 * URL searchParams 또는 form에서 개인화 컨텍스트 생성.
 * ?companion=family&pref=value,comfort&recent=1&verified=1
 */
export function parseReviewPersonalizationContext(
  searchParams: RawPersonalizationParams | Record<string, string | string[] | undefined>,
): ReviewPersonalizationContext {
  const raw = searchParams as Record<string, string | string[] | undefined>;
  const get = (k: string): string | undefined => {
    const v = raw[k];
    if (v == null) return undefined;
    return Array.isArray(v) ? v[0] : v;
  };

  const companionRaw = get("companion");
  const companionType =
    companionRaw && COMPANION_PARAM_VALUES[companionRaw.toLowerCase()]
      ? COMPANION_PARAM_VALUES[companionRaw.toLowerCase()]
      : undefined;

  const prefRaw = get("pref");
  const preferenceTags: TravelPreferenceTag[] = [];
  if (prefRaw) {
    for (const p of prefRaw.split(",").map((s) => s.trim().toLowerCase())) {
      const tag = PREF_PARAM_VALUES[p];
      if (tag && !preferenceTags.includes(tag)) preferenceTags.push(tag);
    }
  }

  const recentRaw = get("recent");
  const prefersRecentReviews = recentRaw === "1" || recentRaw === "true" || recentRaw === "yes";

  const verifiedRaw = get("verified");
  const prefersVerifiedReviews = verifiedRaw === "1" || verifiedRaw === "true" || verifiedRaw === "yes";

  const minRatingRaw = get("minRating");
  let minPreferredRating: number | undefined;
  if (minRatingRaw) {
    const n = parseInt(minRatingRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) minPreferredRating = n;
  }

  return normalizePersonalizationContext({
    companionType,
    preferenceTags: preferenceTags.length ? preferenceTags : undefined,
    minPreferredRating,
    prefersVerifiedReviews,
    prefersRecentReviews,
  });
}

export function normalizePersonalizationContext(
  raw: Partial<ReviewPersonalizationContext>,
): ReviewPersonalizationContext {
  const defaultCtx = getDefaultPersonalizationContext();
  return {
    ...defaultCtx,
    ...raw,
    companionType: raw.companionType ?? defaultCtx.companionType,
    preferenceTags: raw.preferenceTags ?? defaultCtx.preferenceTags,
    minPreferredRating: raw.minPreferredRating ?? defaultCtx.minPreferredRating,
    prefersVerifiedReviews: raw.prefersVerifiedReviews ?? defaultCtx.prefersVerifiedReviews,
    prefersRecentReviews: raw.prefersRecentReviews ?? defaultCtx.prefersRecentReviews,
  };
}
