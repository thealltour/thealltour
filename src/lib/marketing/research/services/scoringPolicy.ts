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

export type ResearchScoreComponents = Record<ResearchScoreComponentKey, number> & {
  /** Optional; not part of CALIBRATED_RESEARCH_SCORE_WEIGHTS. */
  koreanOutbound?: number;
};

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

/** Soft pool-ranking blend. Does not mutate composite research quality score. */
export function computeAgendaPoolRankScore(input: {
  compositeResearchScore: number;
  koreanOutboundRelevanceScore: number;
  agendaSeedWeight?: number;
}): number {
  const quality = Math.max(0, Math.min(1, input.compositeResearchScore));
  const outbound = Math.max(0, Math.min(1, input.koreanOutboundRelevanceScore));
  const seed = Math.max(0, Math.min(1, input.agendaSeedWeight ?? 0.5));
  // Weak seed sources (e.g. FCDO) contribute less as agenda heads even when credible.
  const seedAdjustedOutbound = outbound * (0.55 + 0.45 * seed);
  let score = quality * 0.42 + seedAdjustedOutbound * 0.58;
  if (outbound < 0.15) {
    score *= 0.35; // soft demotion, not hard delete
  } else if (outbound < 0.28) {
    score *= 0.7;
  }
  return Math.max(0, Math.min(1, score));
}
