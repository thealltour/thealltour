import type {
  CompactManagerAgendaCandidate,
  CompactManagerEvidenceRef,
  CompactManagerResearchBrief,
  MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";
import { MARKETING_RESEARCH_CONTEXT_CONTRACT } from "@/lib/marketing/research/manager/types";

export const NOW = new Date("2026-09-02T00:00:00.000Z");
export const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

export const officialEvidence: CompactManagerEvidenceRef = {
  evidenceId: "ev-official",
  sourceId: "src-official",
  sourceType: "official_government",
  sourceName: "JNTO",
  isOfficial: true,
  evidenceType: "official_statement",
  url: "https://example.com/official",
  reference: null,
  excerpt: "Japan autumn travel guidance updated.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
};

export const agendaCandidate: CompactManagerAgendaCandidate = {
  agendaCandidateId: "ac-japan-autumn",
  researchBriefId: "rb-japan-autumn",
  title: "Japan autumn travel update",
  summary: "Official guidance changed for autumn travelers.",
  destinations: ["Japan"],
  topics: ["travel", "autumn"],
  entities: ["JNTO"],
  signalTypes: ["official_update"],
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
  freshnessScore: 0.9,
  credibilityScore: 0.85,
  travelRelevanceScore: 0.8,
  publicInterestScore: 0.7,
  commercialRelevanceScore: 0.4,
  seasonalityScore: 0.75,
  corroborationScore: 0.6,
  noveltyScore: 0.5,
  totalResearchScore: 0.72,
  researchScoreComponents: null,
  scoreReasons: ["official source"],
  riskFlags: [],
  matchedProductIds: [],
  evidence: [officialEvidence],
  candidateStatus: "eligible",
};

export const researchBrief: CompactManagerResearchBrief = {
  researchBriefId: "rb-japan-autumn",
  title: "Japan autumn travel update",
  summary: "Official guidance changed for autumn travelers.",
  destinations: ["Japan"],
  topics: ["travel", "autumn"],
  entities: ["JNTO"],
  signalTypes: ["official_update"],
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
  freshnessScore: 0.9,
  credibilityScore: 0.85,
  travelRelevanceScore: 0.8,
  publicInterestScore: 0.7,
  corroborationScore: 0.6,
  commercialRelevance: { level: "low", matchedProductIds: [] },
  evidence: [officialEvidence],
  risks: [],
  openQuestions: [],
  generatedAt: NOW.toISOString(),
  validUntil: null,
};

export function buildResearchContext(
  overrides: Partial<MarketingResearchContext> = {},
): MarketingResearchContext {
  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status: "ok",
    generatedAt: NOW.toISOString(),
    window: {
      lookbackHours: 72,
      since: "2026-08-30T00:00:00.000Z",
      until: NOW.toISOString(),
    },
    agendaCandidates: [agendaCandidate],
    briefs: [researchBrief],
    sourceSummary: {
      officialSourceCount: 1,
      newsSourceCount: 0,
      independentSourceFamilies: 1,
      evidenceCount: 1,
    },
    degradedState: null,
    observability: {
      requestedAt: NOW.toISOString(),
      candidateCount: 1,
      briefCount: 1,
      topScore: 0.72,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
    notes: [],
    ...overrides,
  };
}

export function managerSelectJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    decision: "select",
    title: "Japan autumn travel update",
    summary: "Official guidance changed for autumn travelers.",
    agendaCandidateId: "ac-japan-autumn",
    researchBriefId: "rb-japan-autumn",
    rationale: ["timely official update"],
    deferReason: null,
    ...overrides,
  });
}

export function productlessManagerJson(): string {
  return JSON.stringify({
    decision: "select",
    title: "Autumn rail pass trends in Europe",
    summary: "Productless travel interest topic with community evidence.",
    agendaCandidateId: null,
    researchBriefId: null,
    rationale: ["seasonal interest without product tie"],
    deferReason: null,
  });
}
