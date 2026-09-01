import { randomUUID } from "node:crypto";

import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";

const RESEARCH_SCORE_WEIGHTS = {
  freshness: 0.2,
  credibility: 0.25,
  travelRelevance: 0.25,
  publicInterest: 0.15,
  commercialLinkage: 0.1,
  seasonality: 0.05,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildAgendaCandidateFromBrief(
  brief: ResearchBrief,
  now: Date = new Date(),
): AgendaCandidate {
  const freshnessScore = brief.freshness.freshnessScore ?? 0.5;
  const credibilityScore = brief.credibility.score;
  const travelRelevanceScore = brief.travelRelevance.score;
  const publicInterestScore = brief.publicInterest;
  const commercialLinkageScore =
    brief.commercialRelevance?.level === "high"
      ? 0.85
      : brief.commercialRelevance?.level === "medium"
        ? 0.6
        : brief.commercialRelevance?.level === "low"
          ? 0.35
          : 0.2;
  const seasonalityScore = brief.topics.some((t) => /season|spring|summer|festival/i.test(t))
    ? 0.7
    : 0.4;
  const historicalDuplicationScore = 0.5;

  const compositeResearchScore = clamp01(
    freshnessScore * RESEARCH_SCORE_WEIGHTS.freshness +
      credibilityScore * RESEARCH_SCORE_WEIGHTS.credibility +
      travelRelevanceScore * RESEARCH_SCORE_WEIGHTS.travelRelevance +
      publicInterestScore * RESEARCH_SCORE_WEIGHTS.publicInterest +
      commercialLinkageScore * RESEARCH_SCORE_WEIGHTS.commercialLinkage +
      seasonalityScore * RESEARCH_SCORE_WEIGHTS.seasonality,
  );

  const riskFlags = [...brief.risks];
  if (credibilityScore < 0.4) riskFlags.push("low_credibility");

  const timestamp = now.toISOString();

  return {
    id: randomUUID(),
    researchBriefId: brief.id,
    title: brief.title,
    rationale: brief.summary,
    freshnessScore,
    publicInterestScore,
    travelRelevanceScore,
    credibilityScore,
    commercialLinkageScore,
    historicalDuplicationScore,
    seasonalityScore,
    compositeResearchScore,
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
