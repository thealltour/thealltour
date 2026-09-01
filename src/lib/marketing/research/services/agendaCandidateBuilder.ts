import { randomUUID } from "node:crypto";

import {
  scoreHistoricalDuplication,
  scoreNovelty,
} from "@/lib/marketing/research/services/noveltyScorer";
import {
  buildScoreReasons,
  computeCompositeResearchScore,
  type ResearchScoreComponents,
} from "@/lib/marketing/research/services/scoringPolicy";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";

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

export function buildAgendaCandidateFromBrief(
  brief: ResearchBrief,
  now: Date = new Date(),
  priorBriefs: ResearchBrief[] = [],
): AgendaCandidate {
  const components = buildResearchScoreComponents(brief, priorBriefs);
  const novelty = scoreNovelty({ brief, priorBriefs });
  const compositeResearchScore = computeCompositeResearchScore(components);
  const scoreReasons = buildScoreReasons(components);

  const riskFlags = [...brief.risks];
  if (components.credibility < 0.4) riskFlags.push("low_credibility");
  if (novelty.penalty >= 0.3) riskFlags.push("topic_repetition");

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
    compositeResearchScore,
    researchScoreComponents: components,
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

export function rankAgendaCandidates(candidates: AgendaCandidate[]): AgendaCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      b.compositeResearchScore - a.compositeResearchScore ||
      (b.corroborationScore ?? 0) - (a.corroborationScore ?? 0) ||
      b.freshnessScore - a.freshnessScore,
  );
}
