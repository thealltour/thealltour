import type { ResearchSignalType } from "@/lib/marketing/research/types/enums";

/**
 * Source semantics persisted at `research_sources.metadata.semantics`.
 * Runtime reads `lifecycle`, `classification`, `coverage` (terminal geography fallback only),
 * `languages.primary` (terminal signal language fallback, and the derived legacy `language`)
 * and `commercialBias` (final MM rank seed only).
 */

/**
 * How strongly the publisher has a commercial or promotional interest in its own coverage.
 * This is agenda independence, not factual credibility: it only attenuates the source's
 * above-neutral agenda seed in the final MM rank.
 */
export const RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS = ["none", "low", "medium", "high"] as const;

export type ResearchSourceCommercialBias = (typeof RESEARCH_SOURCE_COMMERCIAL_BIAS_LEVELS)[number];

export const RESEARCH_SOURCE_COVERAGE_SCOPES = ["global", "multi_country", "country", "city"] as const;

export type ResearchSourceCoverageScope = (typeof RESEARCH_SOURCE_COVERAGE_SCOPES)[number];

export const RESEARCH_SOURCE_LIFECYCLE_STATUSES = ["active", "shadow", "paused", "retired"] as const;

export type ResearchSourceLifecycleStatus = (typeof RESEARCH_SOURCE_LIFECYCLE_STATUSES)[number];

/**
 * Destinations the source covers, which is distinct from the publisher's own `country`.
 * Only a single declared country/city ever fills a signal's geography, and only when the
 * item carries no geography or named destination of its own.
 */
export type ResearchSourceCoverage = {
  scope: ResearchSourceCoverageScope;
  /** ISO 3166-1 alpha-2. */
  countries?: string[];
  cities?: string[];
};

export type ResearchSourceLanguages = {
  /**
   * Language the source publishes in. It fills a signal's language only when the item supplied none.
   * The legacy source column is a derived display projection.
   */
  primary: string;
};

export type ResearchSourceClassificationPolicy = {
  /**
   * Terminal fallback: used only when the source's own inference (keyword rules, explicit
   * trend mapping) resolves no type. Never overrides a resolved type.
   */
  defaultSignalType: ResearchSignalType;
};

/**
 * - active: collected, persisted, candidate + MM eligible.
 * - shadow: collected and persisted, never a candidate or MM input.
 * - paused / retired: catalog row kept, nothing collected; existing rows are never purged.
 */
export type ResearchSourceLifecycle = {
  status: ResearchSourceLifecycleStatus;
  note?: string;
};

export type ResearchSourceSemantics = {
  commercialBias: ResearchSourceCommercialBias;
  coverage: ResearchSourceCoverage;
  languages: ResearchSourceLanguages;
  classification: ResearchSourceClassificationPolicy;
  lifecycle: ResearchSourceLifecycle;
};
