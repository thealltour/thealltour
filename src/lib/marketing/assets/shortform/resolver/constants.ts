/** SV-4 resolver policy constants — single SoT (no scattered magic numbers). */

export const SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT = 12;
export const SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT = 5;

/** Scores are in [0, 1]. */
export const SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE = 0.78;
export const SHORTFORM_RESOLVER_REVIEW_MIN_SCORE = 0.55;

/** Cap internal reuse so it cannot override weak relevance. */
export const SHORTFORM_RESOLVER_REUSE_BONUS_MAX = 0.08;

export const SHORTFORM_RESOLVER_SCORE_WEIGHTS = {
  relevance: 0.42,
  mediaFit: 0.16,
  orientationFit: 0.12,
  durationFit: 0.1,
  provenance: 0.12,
  reuseBonus: 0.08,
} as const;

export const SHORTFORM_RESOLVER_HTTP_TIMEOUT_MS = 12_000;
/** Pixabay official policy: cache responses ≥ 24 hours. */
export const SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const SHORTFORM_RESOLVER_PROVIDER_LADDER = [
  "internal_catalog",
  "pexels",
  "pixabay",
  "photo_motion",
  "generated_video_plan",
] as const;
