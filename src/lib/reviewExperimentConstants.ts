/**
 * PR26: 리뷰 실험 상수 및 구성.
 */
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";

export const REVIEW_EXPERIMENTS = {
  review_highlight_variant: {
    key: "review_highlight_variant" as const,
    variants: ["control", "personalized_highlights", "summary_first"] as const,
    defaultVariant: "control" as const,
    name: "리뷰 하이라이트 실험",
    description: "상단 노출 방식: 기본 / 개인화 하이라이트 / 요약 우선",
  },
  review_summary_variant: {
    key: "review_summary_variant" as const,
    variants: ["control", "summary_first"] as const,
    defaultVariant: "control" as const,
    name: "리뷰 요약 실험",
    description: "요약 카드 노출 방식",
  },
  review_sort_variant: {
    key: "review_sort_variant" as const,
    variants: ["control", "trust_first", "helpful_first"] as const,
    defaultVariant: "control" as const,
    name: "리뷰 정렬 실험",
    description: "정렬 방식: 기본 / 신뢰도 우선 / 도움됨 우선",
  },
} as const;

export const REVIEW_EXPERIMENT_EVENT_TYPES = [
  "impression",
  "click_review",
  "expand_review",
  "click_helpful",
  "view_summary",
  "conversion",
] as const;

/** 쿼리 파라미터로 variant 강제 (QA용) */
export const QUERY_PARAM_REVIEW_VARIANT = "reviewVariant";
export const QUERY_PARAM_REVIEW_SORT_VARIANT = "reviewSortVariant";

/** cookie 키 (할당 유지) */
export const COOKIE_REVIEW_EXPERIMENT_PREFIX = "review_exp_";

export function getExperimentConfig(key: ReviewExperimentKey): typeof REVIEW_EXPERIMENTS[ReviewExperimentKey] {
  return REVIEW_EXPERIMENTS[key];
}

export function getAllowedVariants(key: ReviewExperimentKey): readonly ReviewExperimentVariant[] {
  return REVIEW_EXPERIMENTS[key].variants;
}

export function getDefaultVariant(key: ReviewExperimentKey): ReviewExperimentVariant {
  return REVIEW_EXPERIMENTS[key].defaultVariant;
}
