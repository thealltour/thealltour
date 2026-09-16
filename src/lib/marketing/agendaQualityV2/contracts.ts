/**
 * AGENDA_QUALITY_V2 — Marketing Agenda Candidate contract.
 * SIGNAL ≠ AGENDA. marketingStorySeedKo is NOT a final Story.
 */

export const MARKETING_AGENDA_CANDIDATE_V2_CONTRACT = "marketing-agenda-candidate-v2" as const;

export const AGENDA_FRESHNESS_CLASSES = [
  "breaking",
  "timely",
  "seasonal",
  "evergreen",
] as const;
export type AgendaFreshnessClass = (typeof AGENDA_FRESHNESS_CLASSES)[number];

export const AGENDA_RESERVOIR_LIFECYCLE_STATUSES = [
  "QUALIFIED",
  "PRESENTED",
  "SELECTED",
  "DEFERRED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
] as const;
export type AgendaReservoirLifecycleStatus =
  (typeof AGENDA_RESERVOIR_LIFECYCLE_STATUSES)[number];

export const AGENDA_STORY_ARCHETYPE_HINTS = [
  "decision_rule",
  "tradeoff",
  "convenience_vs_experience",
  "who_is_it_for",
  "before_you_book",
  "premium_or_overpriced",
  "better_alternative",
  "timing",
  "other",
] as const;
export type AgendaStoryArchetypeHint = (typeof AGENDA_STORY_ARCHETYPE_HINTS)[number];

export type MarketingAgendaCandidateV2 = {
  contract: typeof MARKETING_AGENDA_CANDIDATE_V2_CONTRACT;
  agendaId: string;
  version: number;
  sourceSignalIds: string[];
  sourceBriefIds: string[];
  sourceCandidateIds: string[];
  createdAt: string;
  updatedAt: string;

  signalContext: {
    signalSummaryKo: string;
    sourceTypes: string[];
    destinations: string[];
    topics: string[];
    observedAt: string | null;
    freshnessClass: AgendaFreshnessClass;
  };

  traveler: {
    targetTravelerKo: string;
    travelerProblemKo: string;
    decisionAtStakeKo: string;
    audienceTensionKo: string;
    readerPayoffKo: string;
  };

  editorial: {
    marketingStorySeedKo: string;
    whyNowKo: string;
    researchQuestionsKo: string[];
    nonGoalsKo: string[];
    genericRiskKo: string;
    storyArchetypeHint: AgendaStoryArchetypeHint | string;
  };

  qualityInput: {
    sourceCredibility: number | null;
    sourceFreshness: number | null;
    koreanTravelerRelevance: number | null;
    researchabilityHint: string | null;
    commercialRelevanceHint: string | null;
  };

  provenance: {
    transformSource: "research_brief" | "agenda_candidate" | "research_signal" | "mixed";
    transformModel: string | null;
    transformRevision: string;
    sourceFingerprint: string;
    topicFingerprint: string | null;
    decisionAxisFingerprint: string | null;
    limitations: string[];
  };

  lifecycleStatus: AgendaReservoirLifecycleStatus;
  expiresAt: string | null;
};

export type MarketingAgendaTransformInput = {
  originalTitle: string;
  originalSummary: string;
  sourceTypes: string[];
  destinations?: string[];
  topics?: string[];
  observedAt?: string | null;
  sourceSignalIds?: string[];
  sourceBriefIds?: string[];
  sourceCandidateIds?: string[];
  sourceCredibility?: number | null;
  sourceFreshness?: number | null;
  koreanTravelerRelevance?: number | null;
  commercialRelevanceHint?: string | null;
  researchabilityHint?: string | null;
  sourceFingerprint?: string | null;
};

export type MarketingAgendaTransformerLlmOutput = {
  targetTravelerKo: string;
  travelerProblemKo: string;
  decisionAtStakeKo: string;
  audienceTensionKo: string;
  readerPayoffKo: string;
  marketingStorySeedKo: string;
  whyNowKo: string;
  researchQuestionsKo: string[];
  nonGoalsKo: string[];
  genericRiskKo: string;
  storyArchetypeHint: string;
  freshnessClass: AgendaFreshnessClass | string;
  signalSummaryKo?: string;
  limitations?: string[];
};

export const AGENDA_QUALITY_VERSION = "v2" as const;
export const MARKETING_AGENDA_TRANSFORM_REVISION = "agenda-transform-v1" as const;
