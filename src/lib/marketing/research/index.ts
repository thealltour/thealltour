export * from "@/lib/marketing/research/types";
export * from "@/lib/marketing/research/fingerprint";
export * from "@/lib/marketing/research/validation";
export * from "@/lib/marketing/research/repository";
export * from "@/lib/marketing/research/collectors";
export * from "@/lib/marketing/research/collection/runResearchCollectionCycle";
export { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
export * from "@/lib/marketing/research/services/pipeline";
export { buildSemanticResearchText } from "@/lib/marketing/research/services/semanticText";
export { runSemanticDedup } from "@/lib/marketing/research/services/semanticDeduplicator";
export {
  buildResearchScoreComponents,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
export {
  CALIBRATED_RESEARCH_SCORE_WEIGHTS,
  computeCompositeResearchScore,
} from "@/lib/marketing/research/services/scoringPolicy";
export { scoreFreshness, isStaleFreshness } from "@/lib/marketing/research/services/freshnessScorer";
export { scoreCredibility } from "@/lib/marketing/research/services/credibilityScorer";
export {
  scoreTravelRelevance,
  scorePublicInterest,
} from "@/lib/marketing/research/services/relevanceScorer";
export { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
export { deduplicateSignals } from "@/lib/marketing/research/services/deduplicator";
export {
  buildResearchBriefFromSignals,
  assertResearchBriefNotContentDraft,
} from "@/lib/marketing/research/services/briefBuilder";
export {
  buildAgendaCandidateFromBrief,
  assertAgendaCandidateNotFinalDecision,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
export {
  getMarketingManagerResearchContext,
} from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
export type {
  MarketingResearchContext,
  GetMarketingManagerResearchContextOptions,
} from "@/lib/marketing/research/manager/types";
export { MARKETING_RESEARCH_CONTEXT_CONTRACT } from "@/lib/marketing/research/manager/types";

export {
  scoreKoreanOutboundRelevance,
  detectKoreanOutboundDemandBand,
} from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
export { classifyTravelDirection } from "@/lib/marketing/research/services/travelDirection";
export type { TravelDirection } from "@/lib/marketing/research/services/travelDirection";
export {
  resolveSourceRoleWeights,
  aggregateEvidenceSourceRoleWeights,
  buildSourcePortfolioMetadata,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
export { computeAgendaPoolRankScore } from "@/lib/marketing/research/services/scoringPolicy";
export { DEFERRED_RESEARCH_SOURCES_V1 } from "@/lib/marketing/research/collectors/config";
