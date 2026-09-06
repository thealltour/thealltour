export type SemanticBand =
  | "diagnostic_only"
  | "same_topic_signal"
  | "near_duplicate_candidate"
  | "strong_duplicate_candidate";

/** Exact identity — cooldown / title dedupe layer, not semantic demotion. */
export type SemanticDeterministicExactSignal =
  | "canonical_url_match"
  | "normalized_title_match";

/** Content/event signals that may gate a semantic soft penalty. */
export type SemanticContentCorroborator =
  | "title_token_overlap"
  | "destination_topic_and_date";

/**
 * Context/bias diagnostics — never sufficient alone for demotion.
 * Includes publisher/series/destination/date ambient inflation.
 */
export type SemanticContextSignal =
  | "source_family_same"
  | "series_template_hint"
  | "destination_overlap_only"
  | "topic_overlap_only"
  | "destination_and_topic_match"
  | "date_proximity";

/** @deprecated Prefer contentCorroborators / contextSignals. Kept for metadata compat. */
export type SemanticCorroborationSignal =
  | SemanticDeterministicExactSignal
  | SemanticContentCorroborator
  | SemanticContextSignal;

export type SemanticDemotionDecision = {
  agendaCandidateId: string;
  researchBriefId: string;
  semanticAvailable: boolean;
  semanticSimilarity: number | null;
  comparedResearchBriefId: string | null;
  comparedAgendaCandidateId: string | null;
  semanticBand: SemanticBand | null;
  contentCorroborators: SemanticContentCorroborator[];
  contextSignals: SemanticContextSignal[];
  deterministicExactSignals: SemanticDeterministicExactSignal[];
  /** Union for compact logging — prefer the split fields above. */
  duplicateSignals: SemanticCorroborationSignal[];
  demotionAmount: number;
  demotionReason: string | null;
  /** When true, prior ranking behavior is preserved (no demotion applied). */
  degraded?: boolean;
  degradeReason?: string | null;
};

export type SemanticSoftDemotionReport = {
  /** Resolved activation mode for this run. */
  mode: import("@/lib/marketing/cron/daily/semanticSoftDemotion/demotionModeConfig").MarketingSemanticDemotionMode;
  semanticAvailable: boolean;
  degraded: boolean;
  degradeReason: string | null;
  model: string;
  revision: string;
  sourceTextVersion: string;
  /** Durable embeddings successfully loaded for this pool. */
  embeddingsLoaded: number;
  /** Alias for diagnostics: same as embeddingsLoaded. */
  embeddingAvailableCount: number;
  /** Candidates that had at least one peer embedding comparison. */
  comparedCount: number;
  /**
   * Decisions with demotionAmount > 0 under E-4F policy (hypothetical if not live).
   * Kept for backward compat — prefer hypotheticalDemotedCount / appliedDemotedCount.
   */
  demotedCount: number;
  /** Policy-qualifying demotions computed (shadow or live). */
  hypotheticalDemotedCount: number;
  /** Demotions actually applied to totalResearchScore (live only). */
  appliedDemotedCount: number;
  decisions: SemanticDemotionDecision[];
};
