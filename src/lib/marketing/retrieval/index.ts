export {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  RETRIEVAL_SOURCE_KEYS,
} from "@/lib/marketing/retrieval/constants";
export { buildRetrievalPlan, defaultSourcesForPurpose } from "@/lib/marketing/retrieval/planner";
export { executeRetrievalPlan, assembleFromRetrieval } from "@/lib/marketing/retrieval/executeRetrievalPlan";
export { runMarketingRetrieval } from "@/lib/marketing/retrieval/runMarketingRetrieval";
export {
  clampRetrievalLimit,
  parseMarketingRetrievalRequest,
  resolveRetrievalPeriod,
  withComposePeriodDefaults,
  canonicalPurpose,
  requireRetrievalPeriod,
  assertPlanPeriod,
} from "@/lib/marketing/retrieval/validation";
export type {
  ExecutedRetrieval,
  MarketingRetrievalRequest,
  ParsedMarketingRetrievalRequest,
  RetrievalAdapters,
  RetrievalPlan,
  RetrievalResult,
  RetrievalSourceKey,
} from "@/lib/marketing/retrieval/types";
