/**
 * STEP E-4 calibrated semantic soft-demotion bands.
 * Exact deterministic identity remains separate (researchIdentityCooldown).
 * Semantic score alone never hard-rejects.
 */
import {
  MARKETING_SEMANTIC_DEFAULT_MODEL,
} from "@/lib/marketing/semantic/entityEmbeddings/constants";
import {
  DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/semantic/entityEmbeddings/types";

export const SEMANTIC_SOFT_DEMOTION_MODEL = MARKETING_SEMANTIC_DEFAULT_MODEL;
export const SEMANTIC_SOFT_DEMOTION_REVISION = DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION;
export const SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION = MARKETING_SEMANTIC_SOURCE_TEXT_VERSION;

/** Inclusive upper bounds / thresholds from E-3B calibration. */
export const SEMANTIC_BAND_DIAGNOSTIC_MAX = 0.52;
export const SEMANTIC_BAND_SAME_TOPIC_MAX = 0.68;
export const SEMANTIC_BAND_NEAR_DUPLICATE_MAX = 0.8;
export const SEMANTIC_BAND_STRONG_MIN = 0.82;

/** Multiplicative soft demotion amounts (subtracted from 1.0 as score *= 1 - amount). */
export const SEMANTIC_DEMOTION_WEAK = 0.05;
export const SEMANTIC_DEMOTION_MODERATE = 0.12;
export const SEMANTIC_DEMOTION_STRONG = 0.22;

export const SEMANTIC_TITLE_TOKEN_OVERLAP_WEAK = 0.25;
export const SEMANTIC_TITLE_TOKEN_OVERLAP_STRONG = 0.45;
export const SEMANTIC_DATE_PROXIMITY_DAYS = 3;
