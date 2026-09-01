import type { ResearchScoreComponents } from "@/lib/marketing/research/services/scoringPolicy";

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

export type MarketingResearchObservability = {
  requestedAt: string;
  candidateCount: number;
  briefCount: number;
  topScore: number | null;
  degraded: boolean;
  staleExcludedCount: number;
  duplicateExcludedCount: number;
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
};
