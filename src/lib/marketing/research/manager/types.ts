import type { ResearchScoreComponents } from "@/lib/marketing/research/services/scoringPolicy";
import type { ResearchSourceCommercialBias } from "@/lib/marketing/research/types/sourceSemantics";

export const MARKETING_RESEARCH_CONTEXT_CONTRACT = "marketing-research-context-v1" as const;

export type MarketingResearchContextStatus = "ok" | "empty" | "degraded" | "unavailable";

export type CompactManagerEvidenceRef = {
  evidenceId: string;
  sourceId: string;
  sourceType: string | null;
  sourceName: string | null;
  isOfficial: boolean;
  evidenceType: string;
  url: string | null;
  reference: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  observedAt: string;
};

export type CompactManagerResearchBrief = {
  researchBriefId: string;
  title: string;
  summary: string;
  destinations: string[];
  topics: string[];
  entities: string[];
  signalTypes: string[];
  publishedAt: string | null;
  observedAt: string;
  freshnessScore: number;
  credibilityScore: number;
  travelRelevanceScore: number;
  publicInterestScore: number;
  corroborationScore: number | null;
  commercialRelevance: {
    level: string;
    matchedProductIds: string[];
  } | null;
  evidence: CompactManagerEvidenceRef[];
  risks: string[];
  openQuestions: string[];
  generatedAt: string;
  validUntil: string | null;
};

export type CompactManagerAgendaCandidate = {
  agendaCandidateId: string;
  researchBriefId: string;
  title: string;
  summary: string;
  destinations: string[];
  topics: string[];
  entities: string[];
  signalTypes: string[];
  publishedAt: string | null;
  observedAt: string;
  freshnessScore: number;
  credibilityScore: number;
  travelRelevanceScore: number;
  publicInterestScore: number;
  commercialRelevanceScore: number;
  seasonalityScore: number;
  corroborationScore: number;
  noveltyScore: number;
  koreanOutboundRelevanceScore: number;
  totalResearchScore: number;
  researchScoreComponents: ResearchScoreComponents | null;
  scoreReasons: string[];
  riskFlags: string[];
  matchedProductIds: string[];
  evidence: CompactManagerEvidenceRef[];
  candidateStatus: string;
};

export type MarketingResearchSourceSummary = {
  officialSourceCount: number;
  newsSourceCount: number;
  independentSourceFamilies: number;
  evidenceCount: number;
};

export type MarketingResearchDegradedState = {
  semanticInfrastructureAvailable: boolean;
  reason: string | null;
};

/** Agenda candidate pre-pool read: rows scanned vs unique source articles kept. */
export type MarketingResearchArticlePrePool = {
  mode: "unique_article_pages" | "legacy_row_limit";
  targetUniqueArticles: number;
  fetchedCandidateRows: number;
  uniqueArticleCandidates: number;
  duplicateRowsDropped: number;
  pagesRead: number;
  lookbackExhausted: boolean;
  maxPagesReached: boolean;
};

/** How the final MM curation input was filled (diversify passes) and its source/family mix. */
export type MarketingResearchCurationDiversityFill = {
  pass1Picked: number;
  pass1bPicked: number;
  stagedFillPicked: number;
  maxRelaxedCapUsed: number | null;
  unrestrictedFillPicked: number;
  weakFallbackPicked: number;
  sourceCounts: Record<string, number>;
  familyCounts: Record<string, number>;
};

/** Final-rank agenda seed attenuated by source commercial bias; composite and Korean outbound are unaffected. */
export type MarketingResearchAgendaSeedAttenuation = {
  /** Compatibility name: rank-input candidates whose seed was lowered, before final selection. */
  attenuatedRankedCount: number;
  /**
   * Always equal to `attenuatedRankedCount`: counts attenuated rank-input candidates, so it can exceed
   * `candidates.length`.
   */
  attenuatedCandidateCount: number;
  /** Returned candidates whose rank seed was lowered. */
  candidates: Array<{
    agendaCandidateId: string;
    commercialBias: ResearchSourceCommercialBias | null;
    rawAgendaSeedWeight: number;
    biasAdjustedAgendaSeedWeight: number;
    seedSourceId: string | null;
  }>;
};

export type MarketingResearchObservability = {
  requestedAt: string;
  candidateCount: number;
  briefCount: number;
  topScore: number | null;
  degraded: boolean;
  staleExcludedCount: number;
  duplicateExcludedCount: number;
  articlePrePool?: MarketingResearchArticlePrePool;
  curationDiversityFill?: MarketingResearchCurationDiversityFill;
  agendaSeedAttenuation?: MarketingResearchAgendaSeedAttenuation;
};

export type MarketingResearchContext = {
  contract: typeof MARKETING_RESEARCH_CONTEXT_CONTRACT;
  status: MarketingResearchContextStatus;
  generatedAt: string;
  window: {
    lookbackHours: number;
    since: string;
    until: string;
  };
  agendaCandidates: CompactManagerAgendaCandidate[];
  briefs: CompactManagerResearchBrief[];
  sourceSummary: MarketingResearchSourceSummary;
  degradedState: MarketingResearchDegradedState | null;
  observability: MarketingResearchObservability;
  notes: string[];
};

export type GetMarketingManagerResearchContextOptions = {
  limit?: number;
  lookbackHours?: number;
  topic?: string;
  destination?: string;
  now?: Date;
  /**
   * Identities to drop before diversification and the `limit` cut (produced, rejected,
   * or already shown on an earlier slate), so exclusions do not shrink the MM pool.
   */
  excludeResearchIdentities?: import("@/lib/marketing/cron/daily/researchIdentityCooldown").ResearchIdentitySet;
};
