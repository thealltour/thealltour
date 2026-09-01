/**
 * Calibrated research ranking weights (STEP 3-3).
 * Commercial linkage is intentionally capped as a bonus, not a gate.
 */
export const CALIBRATED_RESEARCH_SCORE_WEIGHTS = {
  freshness: 0.18,
  credibility: 0.22,
  travelRelevance: 0.22,
  publicInterest: 0.14,
  corroboration: 0.08,
  novelty: 0.07,
  seasonality: 0.04,
  commercial: 0.05,
} as const;

export type ResearchScoreComponentKey = keyof typeof CALIBRATED_RESEARCH_SCORE_WEIGHTS;

export type ResearchScoreComponents = Record<ResearchScoreComponentKey, number>;

export function computeCompositeResearchScore(components: ResearchScoreComponents): number {
  const weights = CALIBRATED_RESEARCH_SCORE_WEIGHTS;
  const total =
    components.freshness * weights.freshness +
    components.credibility * weights.credibility +
    components.travelRelevance * weights.travelRelevance +
    components.publicInterest * weights.publicInterest +
    components.corroboration * weights.corroboration +
    components.novelty * weights.novelty +
    components.seasonality * weights.seasonality +
    components.commercial * weights.commercial;
  return Math.max(0, Math.min(1, total));
}

export function buildScoreReasons(components: ResearchScoreComponents): string[] {
  const reasons: string[] = [];
  const entries = Object.entries(components) as Array<[ResearchScoreComponentKey, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  for (const [key, value] of entries.slice(0, 4)) {
    reasons.push(`${key}_${value.toFixed(2)}`);
  }
  return reasons;
}
