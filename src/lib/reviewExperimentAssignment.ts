/**
 * PR26: 리뷰 실험 variant 할당 로직.
 * query override → cookie/stored → deterministic hash → default.
 */
import type {
  ReviewExperimentKey,
  ReviewExperimentVariant,
  ReviewExperimentAssignment,
} from "@/types/reviewExperiment";
import {
  getExperimentConfig,
  getAllowedVariants,
  getDefaultVariant,
  QUERY_PARAM_REVIEW_VARIANT,
  QUERY_PARAM_REVIEW_SORT_VARIANT,
  COOKIE_REVIEW_EXPERIMENT_PREFIX,
} from "./reviewExperimentConstants";

const HASH_SEED = "review_exp_v1";

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & 0x7fff_ffff;
  }
  return Math.abs(h);
}

/**
 * subjectKey 기준 결정적 variant 할당 (같은 키 → 같은 variant).
 */
export function assignReviewExperimentVariant(
  experimentKey: ReviewExperimentKey,
  subjectKey?: string,
): ReviewExperimentAssignment {
  const config = getExperimentConfig(experimentKey);
  const variants = config.variants;
  const defaultVariant = config.defaultVariant;

  if (!subjectKey || subjectKey.length === 0) {
    return {
      experimentKey,
      variant: defaultVariant,
      assignedAt: new Date().toISOString(),
      subjectKey: undefined,
    };
  }

  const hashInput = `${HASH_SEED}:${experimentKey}:${subjectKey}`;
  const hash = simpleHash(hashInput);
  const index = hash % variants.length;
  const variant = variants[index];

  return {
    experimentKey,
    variant: variant ?? defaultVariant,
    assignedAt: new Date().toISOString(),
    subjectKey,
  };
}

export type GetVariantContext = {
  /** query param override (QA용) */
  queryVariant?: string;
  querySortVariant?: string;
  /** 이미 저장된 할당 (cookie/localStorage에서 읽은 값) */
  persistedVariant?: string;
  /** deterministic 할당용 (anonymous id, session id 등) */
  subjectKey?: string;
};

/**
 * 실제 사용할 variant 결정. 우선순위: query override → persisted → deterministic → default.
 */
export function getReviewExperimentVariant(
  experimentKey: ReviewExperimentKey,
  context: GetVariantContext,
): ReviewExperimentVariant {
  const allowed = getAllowedVariants(experimentKey);
  const defaultVariant = getDefaultVariant(experimentKey);

  const param =
    experimentKey === "review_sort_variant"
      ? context.querySortVariant
      : context.queryVariant;

  if (param && typeof param === "string") {
    const normalized = param.trim().toLowerCase();
    if (allowed.includes(normalized as ReviewExperimentVariant)) {
      return normalized as ReviewExperimentVariant;
    }
  }

  if (context.persistedVariant && allowed.includes(context.persistedVariant as ReviewExperimentVariant)) {
    return context.persistedVariant as ReviewExperimentVariant;
  }

  const assignment = assignReviewExperimentVariant(experimentKey, context.subjectKey);
  return assignment.variant;
}

export function isValidReviewExperimentVariant(
  experimentKey: ReviewExperimentKey,
  variant: string,
): variant is ReviewExperimentVariant {
  const allowed = getAllowedVariants(experimentKey);
  return allowed.includes(variant as ReviewExperimentVariant);
}
