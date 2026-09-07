/**
 * TrendSignalPayload v1 — Meta AI Trend Discovery + Editorial Intelligence contract.
 * Layers must stay separated: discovery / editorial / factual / provenance.
 */

export const TREND_SIGNAL_SCHEMA_VERSION = "trend_signal_v1" as const;
export const TREND_SIGNAL_PROVIDER_META_AI = "meta_ai" as const;

export const TREND_TYPES = [
  "destination_interest",
  "fare_price_signal",
  "seasonal_demand",
  "event_festival",
  "travel_pain_point",
  "entry_visa_policy_interest",
  "weather_disruption",
  "safety_disruption",
  "accommodation_trend",
  "activity_trend",
  "content_format_trend",
  "audience_question",
  "competitor_promotion_signal",
  "traveler_behavior_trend",
] as const;

export type TrendType = (typeof TREND_TYPES)[number];

export const TREND_SIGNAL_STATUSES = [
  "single_observation",
  "repeated_pattern",
  "cross_platform_pattern",
] as const;

export type TrendSignalStatus = (typeof TREND_SIGNAL_STATUSES)[number];

export const TREND_FACTUAL_VERIFICATION_STATUSES = ["unverified"] as const;
export type TrendFactualVerificationStatus = (typeof TREND_FACTUAL_VERIFICATION_STATUSES)[number];

export const TREND_TRAVEL_DIRECTIONS = ["outbound"] as const;
export type TrendTravelDirection = (typeof TREND_TRAVEL_DIRECTIONS)[number];

export type TrendProvenanceL1 = {
  level: "L1";
  platform: string;
  account_or_page?: string | null;
  url?: string | null;
  post_id?: string | null;
  captured_at: string;
};

export type TrendProvenanceL2 = {
  level: "L2";
  platform: string;
  account_or_page?: string | null;
  url?: string | null;
  post_id?: string | null;
  captured_at: string;
  /** Aggregated / secondary observation — still may carry a URL. */
  note?: string | null;
};

/** L3 = opaque / aggregated diagnostics — URL forbidden. */
export type TrendProvenanceL3 = {
  level: "L3";
  platform?: string | null;
  account_or_page?: string | null;
  captured_at: string;
  note?: string | null;
};

export type TrendProvenance = TrendProvenanceL1 | TrendProvenanceL2 | TrendProvenanceL3;

export type TrendConfidence = {
  score: number;
  basis: string[];
};

export type TrendPopularity = {
  score: number;
  basis: string[];
};

export type TrendMarketRelevance = {
  origin_market: "KR";
  travel_direction: TrendTravelDirection;
  score: number;
  basis: {
    observed: string[];
    inferred: string[];
  };
};

export type TrendFactualClaim = {
  claim: string;
  verification_status: TrendFactualVerificationStatus;
  notes?: string | null;
};

export type TrendMarketingObservations = {
  hook_signals: string[];
  format_signals: string[];
  audience_pain_points: string[];
  audience_questions: string[];
  persona_estimates: string[];
  content_angles: string[];
};

export type TrendRawContext = {
  excerpt?: string | null;
  notes?: string | null;
  /** Opaque provider diagnostics — never fed to BGE-M3. */
  opaque?: Record<string, unknown> | null;
};

export type TrendObservedMetrics = {
  observation_count: number;
  platform_count: number;
  platforms?: string[];
  engagement_proxy?: number | null;
};

export type TrendWindow = {
  start: string;
  end: string;
};

export type TrendSignalPayloadV1 = {
  schema_version: typeof TREND_SIGNAL_SCHEMA_VERSION;
  provider: typeof TREND_SIGNAL_PROVIDER_META_AI;
  observation_id: string;
  provider_run_id: string;
  provider_run_at: string;
  observed_at: string;
  published_at?: string | null;
  captured_at: string;
  window: TrendWindow;
  trend_type: TrendType;
  trend_signal_status: TrendSignalStatus;
  topic: string;
  summary: string;
  vertical_tags: string[];
  destinations?: string[];
  provider_cluster_hint?: string | null;
  cluster_label?: string | null;
  confidence: TrendConfidence;
  popularity: TrendPopularity;
  market_relevance: TrendMarketRelevance;
  observed_metrics: TrendObservedMetrics;
  marketing_observations: TrendMarketingObservations;
  factual_claims: TrendFactualClaim[];
  provenance: TrendProvenance[];
  raw_context?: TrendRawContext | null;
};

export type TrendSignalBatchV1 = {
  provider: typeof TREND_SIGNAL_PROVIDER_META_AI;
  items: TrendSignalPayloadV1[];
};
