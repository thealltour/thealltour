import { SCORING_WEIGHTS } from "@/lib/marketing/scoring/constants";
import { clamp01 } from "@/lib/marketing/scoring/clamp";
import { scoreBusinessImportance } from "@/lib/marketing/scoring/scoreBusinessImportance";
import { scoreFreshness } from "@/lib/marketing/scoring/scoreFreshness";
import { scoreRelevance } from "@/lib/marketing/scoring/scoreRelevance";
import { scoreReliability } from "@/lib/marketing/scoring/scoreReliability";
import type { ContextCandidate, ContextScore, ScoringRequest, ScoringWeights } from "@/lib/marketing/scoring/types";

export function computeTotalScore(
  parts: Omit<ContextScore, "total">,
  weights: ScoringWeights = SCORING_WEIGHTS,
): number {
  return clamp01(
    parts.relevance * weights.relevance +
      parts.freshness * weights.freshness +
      parts.reliability * weights.reliability +
      parts.businessImportance * weights.businessImportance,
  );
}

export function scoreContextCandidate(
  candidate: ContextCandidate,
  request: ScoringRequest,
  now: Date = new Date(),
  weights: ScoringWeights = SCORING_WEIGHTS,
): ContextScore {
  const relevance = scoreRelevance(candidate, request);
  const freshness = scoreFreshness(candidate, now);
  const reliability = scoreReliability(candidate);
  const businessImportance = scoreBusinessImportance(candidate, request, now);
  return {
    relevance,
    freshness,
    reliability,
    businessImportance,
    total: computeTotalScore({ relevance, freshness, reliability, businessImportance }, weights),
  };
}
