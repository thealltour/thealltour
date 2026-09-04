import { randomUUID } from "node:crypto";

import {
  scoreHistoricalDuplication,
  scoreNovelty,
} from "@/lib/marketing/research/services/noveltyScorer";
import {
  buildScoreReasons,
  computeAgendaPoolRankScore,
  computeCompositeResearchScore,
  type ResearchScoreComponents,
} from "@/lib/marketing/research/services/scoringPolicy";
import { scoreKoreanOutboundRelevance } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import {
  aggregateEvidenceSourceRoleWeights,
  type ResearchSourceRoleWeights,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function commercialLinkageScore(brief: ResearchBrief): number {
  const level = brief.commercialRelevance?.level;
  if (level === "high") return 0.75;
  if (level === "medium") return 0.55;
  if (level === "low") return 0.35;
  return 0.25;
}

export function buildResearchScoreComponents(
  brief: ResearchBrief,
  priorBriefs: ResearchBrief[] = [],
): ResearchScoreComponents {
  const novelty = scoreNovelty({ brief, priorBriefs });
  const seasonalityScore = brief.topics.some((t) => /season|spring|summer|festival|winter/i.test(t))
    ? 0.7
    : 0.4;

  return {
    freshness: clamp01(brief.freshness.freshnessScore ?? 0.5),
    credibility: clamp01(brief.credibility.score),
    travelRelevance: clamp01(brief.travelRelevance.score),
    publicInterest: clamp01(brief.publicInterest),
    corroboration: clamp01(brief.corroboration?.score ?? 0.35),
    novelty: clamp01(novelty.score),
    seasonality: seasonalityScore,
    commercial: commercialLinkageScore(brief),
  };
}

export function resolveKoreanOutboundForBrief(input: {
  brief: ResearchBrief;
  components: ResearchScoreComponents;
  signalTypes?: string[];
  sourceRole?: ResearchSourceRoleWeights | null;
}): { score: number; reasons: string[] } {
  const assessment = scoreKoreanOutboundRelevance({
    title: input.brief.title,
    summary: input.brief.summary,
    destinations: input.brief.destinations,
    topics: input.brief.topics,
    signalTypes: input.signalTypes,
    seasonalityScore: input.components.seasonality,
    commercialLinkageScore: input.components.commercial,
    matchedProductIds: input.brief.commercialRelevance?.matchedProductIds ?? [],
    sourceRole: input.sourceRole ?? null,
  });
  return { score: assessment.score, reasons: assessment.reasons };
}

export function buildAgendaCandidateFromBrief(
  brief: ResearchBrief,
  now: Date = new Date(),
  priorBriefs: ResearchBrief[] = [],
  options: {
    signalTypes?: string[];
    evidenceSources?: Array<ResearchSource | null | undefined>;
  } = {},
): AgendaCandidate {
  const components = buildResearchScoreComponents(brief, priorBriefs);
  const novelty = scoreNovelty({ brief, priorBriefs });
  const compositeResearchScore = computeCompositeResearchScore(components);
  const sourceRole = aggregateEvidenceSourceRoleWeights(options.evidenceSources ?? []);
  const korean = resolveKoreanOutboundForBrief({
    brief,
    components,
    signalTypes: options.signalTypes,
    sourceRole,
  });
  const scoreReasons = [
    ...buildScoreReasons(components),
    ...korean.reasons.map((r) => `koreanOutbound_${r}`),
  ].slice(0, 10);

  const riskFlags = [...brief.risks];
  if (components.credibility < 0.4) riskFlags.push("low_credibility");
  if (novelty.penalty >= 0.3) riskFlags.push("topic_repetition");
  if (korean.score < 0.15) riskFlags.push("low_korean_outbound_relevance");

  const timestamp = now.toISOString();

  return {
    id: randomUUID(),
    researchBriefId: brief.id,
    title: brief.title,
    rationale: brief.summary,
    freshnessScore: components.freshness,
    publicInterestScore: components.publicInterest,
    travelRelevanceScore: components.travelRelevance,
    credibilityScore: components.credibility,
    commercialLinkageScore: components.commercial,
    historicalDuplicationScore: scoreHistoricalDuplication(novelty),
    seasonalityScore: components.seasonality,
    corroborationScore: components.corroboration,
    koreanOutboundRelevanceScore: korean.score,
    compositeResearchScore,
    researchScoreComponents: { ...components, koreanOutbound: korean.score },
    scoreReasons,
    riskFlags,
    supportingEvidenceIds: brief.evidence.map((e) => e.id),
    status: "candidate",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function assertAgendaCandidateNotFinalDecision(candidate: AgendaCandidate): void {
  const forbidden = ["selectedForToday", "finalPriority", "publishDecision"] as const;
  for (const key of forbidden) {
    if (key in (candidate as unknown as Record<string, unknown>)) {
      throw new Error(`AgendaCandidate must not include MM decision field: ${key}`);
    }
  }
}

export function agendaPoolRankScoreForCandidate(
  candidate: AgendaCandidate,
  agendaSeedWeight = 0.5,
): number {
  return computeAgendaPoolRankScore({
    compositeResearchScore: candidate.compositeResearchScore,
    koreanOutboundRelevanceScore: candidate.koreanOutboundRelevanceScore ?? 0.35,
    agendaSeedWeight,
  });
}

export function rankAgendaCandidates(
  candidates: AgendaCandidate[],
  options: { agendaSeedWeightByCandidateId?: Map<string, number> } = {},
): AgendaCandidate[] {
  return [...candidates].sort((a, b) => {
    const seedA = options.agendaSeedWeightByCandidateId?.get(a.id) ?? 0.5;
    const seedB = options.agendaSeedWeightByCandidateId?.get(b.id) ?? 0.5;
    const rankA = agendaPoolRankScoreForCandidate(a, seedA);
    const rankB = agendaPoolRankScoreForCandidate(b, seedB);
    return (
      rankB - rankA ||
      (b.koreanOutboundRelevanceScore ?? 0) - (a.koreanOutboundRelevanceScore ?? 0) ||
      b.compositeResearchScore - a.compositeResearchScore ||
      (b.corroborationScore ?? 0) - (a.corroborationScore ?? 0) ||
      b.freshnessScore - a.freshnessScore
    );
  });
}
