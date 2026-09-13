/**
 * RA-1B — Audience & Content Research Brief (post-selection).
 * Distinct from pre-selection Research Intelligence `ResearchBrief`.
 */

export const AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT =
  "audience-content-research-brief-v1" as const;

export const ACRB_CONTRACT_VERSION = 1 as const;

export const RESEARCH_FINDING_TYPES = [
  "verified_fact",
  "observed_signal",
  "inference",
  "hypothesis",
] as const;
export type ResearchFindingType = (typeof RESEARCH_FINDING_TYPES)[number];

export const ACRB_RESEARCH_STATUSES = ["complete", "partial", "failed"] as const;
export type AcrbResearchStatus = (typeof ACRB_RESEARCH_STATUSES)[number];

export const ACRB_VERDICTS = ["PROCEED", "PROCEED_WITH_CAUTION", "SKIP"] as const;
export type AcrbResearchVerdict = (typeof ACRB_VERDICTS)[number];

export const ACRB_VERDICT_REASON_CODES = [
  "insufficient_evidence",
  "no_useful_content_gap",
  "near_duplicate_recent",
  "low_audience_relevance",
  "saturated_only",
  "no_credible_takeaway",
  "research_failed_unavailable",
  "limited_source_coverage",
  "weak_unofficial_evidence",
  "useful_audience_tension",
  "angles_available",
] as const;
export type AcrbVerdictReasonCode = (typeof ACRB_VERDICT_REASON_CODES)[number];

export const SEARCH_INTENT_CATEGORIES = [
  "informational",
  "planning",
  "comparison",
  "transactional",
  "problem_solving",
] as const;
export type SearchIntentCategory = (typeof SEARCH_INTENT_CATEGORIES)[number];

export const ACRB_CHANNEL_FIT_TARGETS = [
  "threads",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "shortform",
  "cardnews",
] as const;
export type AcrbChannelFitTarget = (typeof ACRB_CHANNEL_FIT_TARGETS)[number];

export const ACRB_SOURCE_CLASSES = [
  "first_party_internal",
  "official",
  "public_social_content",
  "derived_signal",
  "model_inference",
] as const;
export type AcrbSourceClass = (typeof ACRB_SOURCE_CLASSES)[number];

/** Psychological / market item with explicit epistemic type. */
export type AcrbTypedInsight = {
  text: string;
  type: ResearchFindingType;
  confidence: number;
  evidenceRefs: string[];
};

export type AcrbAudienceSection = {
  primary: AcrbTypedInsight[];
  secondary: AcrbTypedInsight[];
  motivations: AcrbTypedInsight[];
  anxieties: AcrbTypedInsight[];
  objections: AcrbTypedInsight[];
  decisionTriggers: AcrbTypedInsight[];
};

export type AcrbSearchIntentSection = {
  primaryIntent: SearchIntentCategory;
  secondaryIntents: SearchIntentCategory[];
  queries: AcrbTypedInsight[];
  questions: AcrbTypedInsight[];
};

export type AcrbMarketSignalsSection = {
  observedPatterns: AcrbTypedInsight[];
  competitorHooks: AcrbTypedInsight[];
  saturatedAngles: AcrbTypedInsight[];
  contentGaps: AcrbTypedInsight[];
};

export type AcrbResearchFinding = {
  findingId: string;
  text: string;
  type: ResearchFindingType;
  confidence: number;
  evidenceRefs: string[];
  sourceClass: AcrbSourceClass | null;
  provenanceNote: string | null;
};

export type AcrbChannelFit = Record<AcrbChannelFitTarget, number>;

export type AcrbContentAngle = {
  angleId: string;
  angle: string;
  hook: string;
  audienceTension: string;
  interestScore: number;
  noveltyScore: number;
  evidenceStrength: number;
  channelFit: AcrbChannelFit;
  rationale: string;
  supportingFindingRefs: string[];
  limitations: string[];
};

export type AcrbSourceCoverage = {
  assignmentEvidence: boolean;
  metaEditorial: boolean;
  internalResearchSignals: boolean;
  semanticRetrieval: boolean;
  historicalContent: boolean;
  externalWebSearch: boolean;
  notes: string[];
};

export type AcrbProvenance = {
  preselectionResearchBriefId: string | null;
  agendaCandidateId: string | null;
  evidenceFingerprint: string;
  synthesisMode: "llm" | "deterministic_fallback" | "reused";
  documentCount: number;
  /** Attempted external search query count (MQ-2: not usable-only). */
  queryCount: number;
  semanticUsed: boolean;
  historicalMatchCount: number;
  /** RA-1C */
  externalResearchUsed?: boolean;
  searchProvider?: string | null;
  externalResultCount?: number;
  fetchedDocumentCount?: number;
  totalFetchedBytes?: number;
  externalResearchRuntimeMs?: number;
  officialSourceCount?: number;
  socialCommunitySourceCount?: number;
  /** MQ-2 additive external-research provenance */
  plannedQueryCount?: number;
  attemptedQueryCount?: number;
  successfulQueryCount?: number;
  failedQueryCount?: number;
  retryCount?: number;
  usableResultCount?: number;
  searchRequestCount?: number;
  externalSearchStatus?: import("@/lib/marketing/audienceResearch/external/researchPolicy").ExternalSearchStatus;
  providerCredentialPresent?: boolean;
};

export type AudienceContentResearchBrief = {
  contract: typeof AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT;
  version: typeof ACRB_CONTRACT_VERSION;
  id: string;
  logicalIdentity: string;
  generatedAt: string;
  selectedAgendaId: string;
  assignmentId: string;
  researchStatus: AcrbResearchStatus;
  sourceCoverage: AcrbSourceCoverage;
  audience: AcrbAudienceSection;
  searchIntent: AcrbSearchIntentSection;
  marketSignals: AcrbMarketSignalsSection;
  researchFindings: AcrbResearchFinding[];
  contentAngles: AcrbContentAngle[];
  recommendedAngleId: string | null;
  recommendedAngleReason: string | null;
  researchVerdict: AcrbResearchVerdict;
  verdictReasons: AcrbVerdictReasonCode[];
  limitations: string[];
  provenance: AcrbProvenance;
  /** MQ-1 durable agenda topic identity — authoritative for angle/query guards. */
  topicIdentity?: import("@/lib/marketing/audienceResearch/topicIdentity/contracts").AgendaTopicIdentity | null;
  /** Lightweight identity-conflict diagnostics (no secrets / no prompts). */
  identityDiagnostics?: import("@/lib/marketing/audienceResearch/topicIdentity/contracts").IdentityConflictDiagnostic[];
};

/** Compact pointer for export-context / candidate metadata. */
export type AudienceContentResearchBriefRef = {
  contract: typeof AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT;
  researchBriefId: string;
  sha256: string;
  researchVerdict: AcrbResearchVerdict;
  researchStatus: AcrbResearchStatus;
  recommendedAngleId: string | null;
  recommendedAngle: string | null;
};

export const PRODUCTION_REQUEST_ACRB_METADATA_KEY = "audienceContentResearchBrief" as const;
export const PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY = "acrbSavedAt" as const;
export const PRODUCTION_OUTCOME_RESEARCH_SKIP = "audience_content_research_skip" as const;
