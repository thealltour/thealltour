export {
  SEMANTIC_BAND_DIAGNOSTIC_MAX,
  SEMANTIC_BAND_NEAR_DUPLICATE_MAX,
  SEMANTIC_BAND_SAME_TOPIC_MAX,
  SEMANTIC_BAND_STRONG_MIN,
  SEMANTIC_DEMOTION_MODERATE,
  SEMANTIC_DEMOTION_STRONG,
  SEMANTIC_DEMOTION_WEAK,
  SEMANTIC_SOFT_DEMOTION_MODEL,
  SEMANTIC_SOFT_DEMOTION_REVISION,
  SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/constants";
export {
  DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE,
  MARKETING_SEMANTIC_DEMOTION_MODE_ENV,
  MARKETING_SEMANTIC_DEMOTION_MODES,
  resolveMarketingSemanticDemotionMode,
  type MarketingSemanticDemotionMode,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/demotionModeConfig";
export type {
  SemanticBand,
  SemanticContentCorroborator,
  SemanticContextSignal,
  SemanticCorroborationSignal,
  SemanticDemotionDecision,
  SemanticDeterministicExactSignal,
  SemanticSoftDemotionReport,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/types";
export {
  computeCorroborationSignals,
  destinationsOverlapOnly,
  normalizeAgendaTitleFingerprint,
  stripSeriesTemplateForContentOverlap,
  titleTokenJaccard,
  type CorroborationBreakdown,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/corroboration";
export {
  computeSemanticDemotion,
  resolveDemotionAmount,
  resolveSemanticBand,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/computeSemanticDemotion";
export { applySemanticDemotion } from "@/lib/marketing/cron/daily/semanticSoftDemotion/applySemanticDemotion";
export {
  resolveSemanticDemotionModeFromDeps,
  runSemanticSoftDemotion,
  type SemanticSoftDemotionDeps,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/runSemanticSoftDemotion";
