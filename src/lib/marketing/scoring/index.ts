export { clamp01, weightsSumToOne } from "@/lib/marketing/scoring/clamp";
export {
  SCORING_WEIGHTS,
  HYBRID_SCORE_WEIGHTS,
  PURPOSE_SOURCE_PRIORITY,
  FRESHNESS_HALF_LIFE_DAYS,
  SOURCE_RELIABILITY,
} from "@/lib/marketing/scoring/constants";
export { scoreRelevance, purposeSourcePriority } from "@/lib/marketing/scoring/scoreRelevance";
export { scoreFreshness, scoreFreshnessFromAge, freshnessHalfLifeDays } from "@/lib/marketing/scoring/scoreFreshness";
export { scoreReliability } from "@/lib/marketing/scoring/scoreReliability";
export { scoreBusinessImportance } from "@/lib/marketing/scoring/scoreBusinessImportance";
export { scoreContextCandidate, computeTotalScore } from "@/lib/marketing/scoring/scoreContext";
export { combineHybridScores } from "@/lib/marketing/scoring/hybridScore";
export { flattenRetrievalCandidates } from "@/lib/marketing/scoring/flattenRetrievalCandidates";
export { rankContextCandidates, selectTopK, compareScoredCandidates } from "@/lib/marketing/scoring/rankContextCandidates";
export { selectScoredContext, rebuildRetrievalFromSelected } from "@/lib/marketing/scoring/selectScoredContext";
export type {
  ContextCandidate,
  ContextCandidateKind,
  ContextScore,
  RankedContextSelection,
  ScoredContextCandidate,
  ScoredRetrievalResult,
  ScoringRequest,
  ScoringWeights,
} from "@/lib/marketing/scoring/types";
