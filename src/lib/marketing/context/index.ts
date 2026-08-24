export type { JsonObject } from "@/lib/marketing/context/json";
export { ContextValidationError } from "@/lib/marketing/context/errors";
export {
  DEFAULT_LOOKBACK_DAYS as DEFAULT_LOOKBACK_DAYS,
  MAX_LOOKBACK_DAYS as MAX_LOOKBACK_DAYS,
  isUuid as isUuid,
  parseMarketingContextRequest,
  requireUuid,
  resolvePeriod,
} from "@/lib/marketing/context/validation";
export { createContextSource } from "@/lib/marketing/context/provenance";
export {
  mapProductRowToContext as mapProductRowToContext,
  collectProductTaxonomyIds as collectProductTaxonomyIds,
} from "@/lib/marketing/context/mappers/productContextMapper";
export { mapTaxonomyRowToContext as mapTaxonomyRowToContext } from "@/lib/marketing/context/mappers/taxonomyContextMapper";
export { assembleMarketingContextPackage } from "@/lib/marketing/context/assembleMarketingContextPackage";
export type {
  BookingInsightContext,
  ContentHistoryItem,
  ContextSource,
  ContextSourceType,
  ConversionSummary,
  CustomerInsightContext,
  InquiryInsightContext,
  MarketingContextPackage,
  MarketingContextRequest,
  MemoryContext,
  MetricSummary,
  PerformanceSummary,
  ProductContext,
  PublicationContext,
  ReviewInsightContext,
  TaxonomyContext,
} from "@/lib/marketing/context/types";
export {
  composeMarketingContext,
  getBookingInsights,
  getContentHistory,
  getCustomerInsights,
  getMemoryContext,
  getPerformanceSummary,
  getProductContext,
  getPublicationHistory,
  getReviewInsights,
  getTaxonomyContext,
} from "@/lib/marketing/context/contextService";
export {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  buildRetrievalPlan,
  clampRetrievalLimit,
  parseMarketingRetrievalRequest,
  resolveRetrievalPeriod,
} from "@/lib/marketing/retrieval";
export type {
  MarketingRetrievalRequest,
  ParsedMarketingRetrievalRequest,
  RetrievalPlan,
  RetrievalResult,
  RetrievalSourceKey,
} from "@/lib/marketing/retrieval";
