export {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  ACRB_CONTRACT_VERSION,
  RESEARCH_FINDING_TYPES,
  ACRB_VERDICTS,
  ACRB_RESEARCH_STATUSES,
  ACRB_CHANNEL_FIT_TARGETS,
  PRODUCTION_REQUEST_ACRB_METADATA_KEY,
  PRODUCTION_OUTCOME_RESEARCH_SKIP,
  type AudienceContentResearchBrief,
  type AudienceContentResearchBriefRef,
  type AcrbResearchVerdict,
  type ResearchFindingType,
} from "@/lib/marketing/audienceResearch/contracts";

export {
  parseAudienceContentResearchBrief,
  assertAudienceContentResearchBrief,
  buildAcrbLogicalIdentity,
  buildEvidenceFingerprint,
  toAudienceContentResearchBriefRef,
  sha256AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/validate";

export {
  loadDurableAcrb,
  persistDurableAcrb,
  readAcrbFromProductionRequest,
  finalizeProductionResearchSkip,
  isProductionResearchSkip,
} from "@/lib/marketing/audienceResearch/persistence";

export { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
export type { EnsureAcrbInput, EnsureAcrbResult } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";

export { synthesizeAudienceContentResearch } from "@/lib/marketing/audienceResearch/synthesize";
export { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
export { gatherAcrbInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
export { runBoundedExternalResearch } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
export {
  EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS,
  EXTERNAL_RESEARCH_OVERALL_BUDGET_MS,
  EXTERNAL_SAFE_FETCH_TIMEOUT_MS,
  EXTERNAL_SEARCH_CONCURRENCY,
  EXTERNAL_SEARCH_MAX_PAID_REQUESTS,
} from "@/lib/marketing/audienceResearch/external/researchPolicy";
export { createResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/createSearchProvider";
export {
  createGeminiGoogleSearchProvider,
  normalizeGeminiGroundingMetadata,
} from "@/lib/marketing/audienceResearch/external/geminiProvider";
export {
  createOpenRouterWebSearchProvider,
  parseOpenRouterUrlCitations,
} from "@/lib/marketing/audienceResearch/external/openrouterProvider";
export { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
export { classifyExternalSource } from "@/lib/marketing/audienceResearch/external/sourceClassify";
export { assertPublicHttpUrl } from "@/lib/marketing/audienceResearch/external/urlSafety";
export {
  applyAngleQualityGate,
  isSeedWrapperAngle,
  pickRecommendedAngle,
} from "@/lib/marketing/audienceResearch/angleQuality";
export {
  mergeLlmIntoSkeleton,
} from "@/lib/marketing/audienceResearch/synthesize";
export {
  mergeTypedInsightLists,
  mergeResearchFindings,
  hasUsefulAcrbCore,
} from "@/lib/marketing/audienceResearch/mergeInsights";
export { reconstructExternalBundleFromAcrb } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
export {
  looksLikeUnsupportedPerformancePrediction,
  sanitizeResearchFindingText,
} from "@/lib/marketing/audienceResearch/external/researchGuards";

export {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH,
  AUDIENCE_CONTENT_RESEARCH_BRIEF_MEDIA_TYPE,
} from "@/lib/marketing/audienceResearch/paths";

export { tryReadAudienceContentResearchBriefFromPackage } from "@/lib/marketing/audienceResearch/readPackageAcrb";

export * from "@/lib/marketing/audienceResearch/topicIdentity";
