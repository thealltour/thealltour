/**
 * AGENDA_QUALITY_V2 — Marketing Agenda Candidate contract.
 * SIGNAL ≠ AGENDA. marketingStorySeedKo is NOT a final Story.
 *
 * Phase 5: travel marketing editorial agenda (not universal decision intelligence).
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

/** Legacy story-shape hints (kept for compatibility). */
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

/** First-class marketing editorial archetypes (Phase 5). */
export const AGENDA_EDITORIAL_ARCHETYPES = [
  "DISCOVERY",
  "HIDDEN_DETAIL",
  "CONTRAST",
  "ALTERNATIVE",
  "CULTURAL_CURIOSITY",
  "EXPERIENCE_FIT",
  "DECISION",
  "PRACTICAL",
] as const;
export type AgendaEditorialArchetype = (typeof AGENDA_EDITORIAL_ARCHETYPES)[number];

/** Archetypes where decision/tension framing remains first-class. */
export const AGENDA_DECISION_ORIENTED_ARCHETYPES: readonly AgendaEditorialArchetype[] = [
  "DECISION",
  "PRACTICAL",
  "EXPERIENCE_FIT",
] as const;

export function isDecisionOrientedArchetype(
  archetype: string | null | undefined,
): boolean {
  return (AGENDA_DECISION_ORIENTED_ARCHETYPES as readonly string[]).includes(
    String(archetype ?? ""),
  );
}

export function parseAgendaEditorialArchetype(
  value: unknown,
): AgendaEditorialArchetype | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return (AGENDA_EDITORIAL_ARCHETYPES as readonly string[]).includes(v)
    ? (v as AgendaEditorialArchetype)
    : null;
}

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
    /** Optional for discovery/curiosity archetypes; required for DECISION/PRACTICAL/EXPERIENCE_FIT. */
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
    /** Phase 5 first-class archetype. */
    editorialArchetype: AgendaEditorialArchetype | string;
    whyInterestingKo: string;
    curiosityHookKo: string;
    hiddenDetailKo: string;
    whyKoreanTravelerCaresKo: string;
    familiarReferenceKo: string;
    alternativeAppealKo: string;
    explorationPayoffKo: string;
    contentImaginabilityKo: string;
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
    promptVersion: string;
    editorialObjectiveVersion: string;
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
  editorialArchetype: string;
  whyInterestingKo: string;
  curiosityHookKo: string;
  hiddenDetailKo: string;
  whyKoreanTravelerCaresKo: string;
  familiarReferenceKo?: string;
  alternativeAppealKo?: string;
  explorationPayoffKo: string;
  contentImaginabilityKo: string;
};

export const AGENDA_QUALITY_VERSION = "v2" as const;
export const MARKETING_AGENDA_TRANSFORM_REVISION = "agenda-transform-v2.1" as const;
export const AGENDA_EDITORIAL_OBJECTIVE_VERSION = "travel-marketing-editorial-v2" as const;
