import type { AgendaV2ScoreBreakdown } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import type { AgendaQualityTier } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";

export function explainAgendaV2Inclusion(params: {
  included: boolean;
  score: AgendaV2ScoreBreakdown;
  exclusionReason?: string | null;
}): string {
  if (params.included) {
    const bits: string[] = [];
    if (params.score.dimensions.decisionUtility >= 0.55) bits.push("Strong traveler decision");
    if (params.score.dimensions.tensionStrength >= 0.5) bits.push("specific tension");
    if (params.score.dimensions.researchability >= 0.5) bits.push("researchable");
    if (params.score.signalQualityScore >= 0.55) bits.push("fresh/credible signal");
    if (params.score.novelty.materialUpdate) bits.push("material update");
    if (bits.length === 0) bits.push("Passed quality gate");
    return bits.join(" + ");
  }

  if (params.exclusionReason === "weak_no_backfill") {
    return "Below publishable floor; WEAK not backfilled";
  }
  if (params.exclusionReason === "decision_axis_soft_diversity") {
    return "Decision axis duplicates stronger candidates";
  }
  if (params.score.penalties.genericRiskPenalty >= 0.3) {
    return "Generic news announcement; no concrete decision";
  }
  if (params.score.penalties.staleTrendPenalty >= 0.35 || params.score.novelty.topicRepeat) {
    return `Repeated topic (${params.score.novelty.reuseKind}); fatigue/reuse penalty`;
  }
  if (params.score.penalties.fatiguePenalty >= 0.2) {
    return "Presentation fatigue from prior Slate appearances";
  }
  if (params.score.qualityTier === "REJECT") {
    return "Empty/generic decision frame or hard reject";
  }
  return params.exclusionReason ?? `Excluded as ${params.score.qualityTier}`;
}

export function tierBucketCounts(tiers: AgendaQualityTier[]): Record<AgendaQualityTier, number> {
  return {
    STRONG: tiers.filter((t) => t === "STRONG").length,
    PUBLISHABLE: tiers.filter((t) => t === "PUBLISHABLE").length,
    WEAK: tiers.filter((t) => t === "WEAK").length,
    REJECT: tiers.filter((t) => t === "REJECT").length,
  };
}
