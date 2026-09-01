import { scoreCredibility } from "@/lib/marketing/research/services/credibilityScorer";
import { isStaleFreshness, scoreFreshness } from "@/lib/marketing/research/services/freshnessScorer";
import {
  scorePublicInterest,
  scoreTravelRelevance,
} from "@/lib/marketing/research/services/relevanceScorer";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export function enrichResearchSignal(
  signal: ResearchSignal,
  source: ResearchSource,
  now: Date = new Date(),
): ResearchSignal {
  const freshness = scoreFreshness({
    signalType: signal.signalType,
    publishedAt: signal.publishedAt,
    observedAt: signal.observedAt,
    expiresAt: signal.expiresAt,
    now,
  });

  const credibility = scoreCredibility({
    source,
    evidence: signal.evidence,
    corroborationCount: signal.corroborationCount,
  });

  const travelRelevance = scoreTravelRelevance({
    signalType: signal.signalType,
    destinations: signal.destinations,
    topics: signal.topics,
    summary: signal.summary,
  });

  const publicInterestScore = scorePublicInterest({
    signalType: signal.signalType,
    travelRelevanceScore: travelRelevance.score,
  });

  let status = signal.status;
  if (isStaleFreshness(freshness)) {
    status = "stale";
  } else if (status === "normalized" || status === "enriched") {
    status = "eligible";
  }

  return {
    ...signal,
    freshness,
    credibility,
    travelRelevance,
    publicInterestScore,
    status,
    updatedAt: now.toISOString(),
  };
}
