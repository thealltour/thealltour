export const DAILY_AGENDA_SLATE_CONTRACT = "daily-agenda-slate-v1" as const;
export const AGENDA_SLATE_CANDIDATE_CONTRACT = "agenda-slate-candidate-v1" as const;

export const MAX_SELECTED_TODAY = 3;

export type AgendaSlateCandidateState =
  | "AVAILABLE"
  | "SELECTED_TODAY"
  | "DEFERRED"
  | "REJECTED";

/** Distinguishes intentional deferred carry-over from organic rediscovery. */
export type AgendaSlateCandidateOrigin = "organic_research" | "deferred_carryover";

export type AgendaSlateEvidenceSummary = {
  evidenceId: string;
  sourceId: string;
  sourceName: string | null;
  sourceType: string | null;
  isOfficial: boolean;
  url: string | null;
  excerpt: string | null;
};

/** Editorial dimensions for human review (not score-alone). */
export type AgendaSlateEditorialDimensions = {
  freshnessWhyNow: string | null;
  koreanTravelerRelevance: string | null;
  practicalTravelValue: string | null;
  theAllTourBusinessRelevance: string | null;
  contentPotential: string | null;
};

export type AgendaSlateCandidate = {
  contract: typeof AGENDA_SLATE_CANDIDATE_CONTRACT;
  /** Stable within a slate (and across carry-over when preserved). */
  slateItemId: string;
  state: AgendaSlateCandidateState;
  origin: AgendaSlateCandidateOrigin;
  /** When origin=deferred_carryover, the prior business date that deferred this item. */
  deferredFromBusinessDateKst: string | null;
  deferredFromSlateItemId: string | null;
  /** Stable research identities (Validation Hardening compatible). */
  agendaCandidateId: string | null;
  researchBriefId: string | null;
  canonicalArticleIds: string[];
  title: string;
  summary: string;
  score: number | null;
  scoreReasons: string[];
  destinations: string[];
  topics: string[];
  entities: string[];
  audienceHint: string | null;
  /** Concise MM recommendation rationale for humans. */
  rationale: string[];
  recommendedFormats: string[];
  recommendedChannel: string | null;
  evidenceSummary: AgendaSlateEvidenceSummary[];
  matchedProductIds: string[];
  riskFlags: string[];
  editorial: AgendaSlateEditorialDimensions;
  researchSnapshot: {
    freshnessScore: number | null;
    credibilityScore: number | null;
    travelRelevanceScore: number | null;
    totalResearchScore: number | null;
  };
};

export type DailyAgendaSlateStatus =
  | "ready_for_human_selection"
  | "empty_deferred"
  | "superseded";

export type DailyAgendaSlate = {
  contract: typeof DAILY_AGENDA_SLATE_CONTRACT;
  slateId: string;
  logicalRunKey: string;
  businessDateKst: string;
  routineId: string;
  runId: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  status: DailyAgendaSlateStatus;
  targetSize: number;
  researchStatus: string | null;
  degraded: boolean;
  candidates: AgendaSlateCandidate[];
  cooldown: {
    days: number;
    excludedAgendaCandidateIds: string[];
    excludedBriefIds: string[];
    rejectedExcludedAgendaCandidateIds?: string[];
  };
  curation: {
    mode: "manager_curated" | "deterministic_fallback";
    managerMessage: string | null;
  };
  observability: {
    organicCount: number;
    deferredCarryoverCount: number;
    availableCount: number;
    selectedTodayCount: number;
  };
  metadata: Record<string, unknown>;
};

export type AgendaSlateAction =
  | "select_today"
  | "defer"
  | "reject"
  | "reset_available";
