import type {
  CommercialRelevance,
  CredibilityAssessment,
  FreshnessMetadata,
  ResearchEvidence,
  TravelRelevanceAssessment,
} from "@/lib/marketing/research/types/researchSignal";
import type { ResearchBriefStatus } from "@/lib/marketing/research/types/enums";
import type { CorroborationAssessment } from "@/lib/marketing/research/services/corroborationScorer";
import type { ResearchScoreComponents } from "@/lib/marketing/research/services/scoringPolicy";
import type {
  ResearchBriefEditorialIntelligence,
  ResearchBriefMarketRelevanceSignals,
  ResearchBriefTrendContext,
} from "@/lib/marketing/research/types/editorialIntelligence";

/** Validated research unit — not a content draft. */
export type ResearchBrief = {
  id: string;
  title: string;
  summary: string;

  signalIds: string[];
  primarySignalId?: string | null;
  clusterId?: string | null;

  claims: string[];
  evidence: ResearchEvidence[];

  topics: string[];
  destinations: string[];
  entities: string[];

  freshness: FreshnessMetadata;
  credibility: CredibilityAssessment;
  travelRelevance: TravelRelevanceAssessment;
  publicInterest: number;
  commercialRelevance?: CommercialRelevance | null;
  corroboration?: CorroborationAssessment | null;

  risks: string[];
  openQuestions: string[];

  generatedAt: string;
  validUntil?: string | null;

  status: ResearchBriefStatus;

  /** B — Editorial intelligence (separated from facts/evidence). */
  editorialIntelligence?: ResearchBriefEditorialIntelligence | null;
  /** A/D — Trend discovery context / provenance diagnostics. */
  trendContext?: ResearchBriefTrendContext | null;
  /** Market relevance input features — not koreanTravelerRelevance. */
  marketRelevanceSignals?: ResearchBriefMarketRelevanceSignals | null;
};

export type AgendaCandidate = {
  id: string;
  researchBriefId: string;

  title: string;
  rationale: string;

  freshnessScore: number;
  publicInterestScore: number;
  travelRelevanceScore: number;
  credibilityScore: number;

  commercialLinkageScore?: number | null;
  historicalDuplicationScore?: number | null;
  seasonalityScore?: number | null;
  corroborationScore?: number | null;
  /** Explicit KR outbound relevance — not travelRelevanceScore. */
  koreanOutboundRelevanceScore?: number | null;

  compositeResearchScore: number;
  researchScoreComponents?: ResearchScoreComponents | null;
  scoreReasons?: string[];

  riskFlags: string[];
  supportingEvidenceIds: string[];

  status: import("@/lib/marketing/research/types/enums").AgendaCandidateStatus;

  createdAt: string;
  updatedAt: string;
};
