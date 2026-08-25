export {
  KNOWN_MEMORY_TYPES,
  type DedupeDecision,
  type ExistingMemoryRow,
  type IngestMemoryDocumentsOptions,
  type KnownMemoryType,
  type MemoryDocument,
  type MemoryIngestionLogger,
  type MemoryIngestionResult,
  type MemoryIngestionSource,
  type MemoryInsertRow,
  type MemoryStore,
  type MemoryType,
  type MemoryUpdateRow,
  type MemoryWriteResult,
  type MemoryWriteStatus,
  type NormalizedMemoryDocument,
} from "@/lib/marketing/memory/types";
export {
  MEMORY_EMBED_BATCH_SIZE,
  MEMORY_INGEST_BATCH_SIZE,
  MEMORY_INGEST_MAX_DOCUMENTS,
  MEMORY_PROVIDER_ABORT_AFTER,
  PRODUCT_MEMORY_CONFIDENCE,
  PRODUCT_MEMORY_DEFAULT_LIMIT,
  PRODUCT_MEMORY_IMPORTANCE_ACTIVE,
  PRODUCT_MEMORY_IMPORTANCE_INACTIVE,
  PRODUCT_MEMORY_MAX_LIMIT,
  PRODUCT_MEMORY_SOURCE_NAME,
  PRODUCT_MEMORY_SOURCE_TYPE,
  PRODUCT_MEMORY_TYPE,
  REVIEW_MEMORY_CONFIDENCE_HIGH,
  REVIEW_MEMORY_CONFIDENCE_LOW,
  REVIEW_MEMORY_CONFIDENCE_MID,
  REVIEW_MEMORY_DEFAULT_LIMIT,
  REVIEW_MEMORY_IMPORTANCE,
  REVIEW_MEMORY_IMPORTANCE_ENOUGH,
  REVIEW_MEMORY_IMPORTANCE_RICH,
  REVIEW_MEMORY_MAX_LIMIT,
  REVIEW_MEMORY_SOURCE_NAME,
  REVIEW_MEMORY_SOURCE_TYPE,
  REVIEW_MEMORY_TYPE,
  CUSTOMER_INSIGHT_CONFIDENCE_HIGH,
  CUSTOMER_INSIGHT_CONFIDENCE_LOW,
  CUSTOMER_INSIGHT_CONFIDENCE_MID,
  CUSTOMER_INSIGHT_DEFAULT_LIMIT,
  CUSTOMER_INSIGHT_DEFAULT_LOOKBACK_DAYS,
  CUSTOMER_INSIGHT_DEFAULT_MIN_INQUIRY_COUNT,
  CUSTOMER_INSIGHT_EXPIRES_DAYS,
  CUSTOMER_INSIGHT_IMPORTANCE_HIGH,
  CUSTOMER_INSIGHT_IMPORTANCE_LOW,
  CUSTOMER_INSIGHT_IMPORTANCE_MID,
  CUSTOMER_INSIGHT_MAX_LIMIT,
  CUSTOMER_INSIGHT_MEMORY_TYPE,
  CUSTOMER_INSIGHT_SOURCE_NAME,
  CUSTOMER_INSIGHT_SOURCE_TYPE,
  PERFORMANCE_MEMORY_CONFIDENCE_HIGH,
  PERFORMANCE_MEMORY_CONFIDENCE_LOW,
  PERFORMANCE_MEMORY_CONFIDENCE_MID,
  PERFORMANCE_MEMORY_DEFAULT_LIMIT,
  PERFORMANCE_MEMORY_DEFAULT_LOOKBACK_DAYS,
  PERFORMANCE_MEMORY_DEFAULT_MIN_EVENT_COUNT,
  PERFORMANCE_MEMORY_EXPIRES_DAYS,
  PERFORMANCE_MEMORY_IMPORTANCE_HIGH,
  PERFORMANCE_MEMORY_IMPORTANCE_LOW,
  PERFORMANCE_MEMORY_IMPORTANCE_MID,
  PERFORMANCE_MEMORY_MAX_LIMIT,
  PERFORMANCE_MEMORY_SOURCE_NAME,
  PERFORMANCE_MEMORY_SOURCE_TYPE,
  PERFORMANCE_MEMORY_TYPE,
  CONTENT_MEMORY_AI_SOURCE_TYPE,
  CONTENT_MEMORY_CONFIDENCE,
  CONTENT_MEMORY_DEFAULT_LIMIT,
  CONTENT_MEMORY_DEFAULT_LOOKBACK_DAYS,
  CONTENT_MEMORY_IMPORTANCE_DEFAULT,
  CONTENT_MEMORY_IMPORTANCE_OLD,
  CONTENT_MEMORY_IMPORTANCE_RECENT,
  CONTENT_MEMORY_MAX_BODY_CHARS,
  CONTENT_MEMORY_MAX_CHARS,
  CONTENT_MEMORY_MAX_LIMIT,
  CONTENT_MEMORY_SOURCE_NAME,
  CONTENT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
export { MemoryIngestionError, MemoryValidationError } from "@/lib/marketing/memory/errors";
export {
  buildEmbeddingText,
  hasStableSource,
  normalizeMemoryDocument,
  normalizeMemoryText,
  parseExpiresAt,
  parseScoreField,
} from "@/lib/marketing/memory/normalization";
export { memoryFingerprint } from "@/lib/marketing/memory/memoryFingerprint";
export { decideMemoryWrite } from "@/lib/marketing/memory/dedupe";
export { MemoryWriter } from "@/lib/marketing/memory/memoryWriter";
export { createDryRunMemoryStore, createSupabaseMemoryStore } from "@/lib/marketing/memory/memoryStore";
export { ingestMemoryDocuments, ingestMemorySource } from "@/lib/marketing/memory/memoryIngestionService";
export {
  createProductMemorySource,
  parseProductMemoryLoadParams,
  ProductMemorySource,
} from "@/lib/marketing/memory/sources/productMemorySource";
export type {
  ParsedProductMemoryLoadParams,
  ProductMemoryLoadParams,
  ProductMemorySourceDeps,
} from "@/lib/marketing/memory/sources/productMemorySource";
export { buildProductMemoryContent, mapProductContextToMemoryDocument } from "@/lib/marketing/memory/productMemoryContent";
export {
  createReviewMemorySource,
  parseReviewMemoryLoadParams,
  ReviewMemorySource,
} from "@/lib/marketing/memory/sources/reviewMemorySource";
export type {
  ParsedReviewMemoryLoadParams,
  ReviewMemoryBundle,
  ReviewMemoryLoadParams,
  ReviewMemorySourceDeps,
} from "@/lib/marketing/memory/sources/reviewMemorySource";
export {
  buildReviewMemoryContent,
  mapReviewInsightToMemoryDocument,
  reviewMemoryConfidence,
  reviewMemoryImportance,
} from "@/lib/marketing/memory/reviewMemoryContent";
export {
  createCustomerInsightMemorySource,
  parseCustomerInsightMemoryLoadParams,
  CustomerInsightMemorySource,
} from "@/lib/marketing/memory/sources/customerInsightMemorySource";
export type {
  CustomerInsightMemoryBundle,
  CustomerInsightMemoryLoadParams,
  CustomerInsightMemorySourceDeps,
  ParsedCustomerInsightMemoryLoadParams,
} from "@/lib/marketing/memory/sources/customerInsightMemorySource";
export {
  buildCustomerInsightMemoryContent,
  customerInsightConfidence,
  customerInsightExpiresAt,
  customerInsightImportance,
  customerInsightSourceId,
  customerInsightWindowKey,
  mapCustomerInsightToMemoryDocument,
} from "@/lib/marketing/memory/customerInsightMemoryContent";
export { parseCustomerInsightMemoryCliArgs } from "@/lib/marketing/memory/customerInsightMemoryCli";
export type { CustomerInsightMemoryCliArgs } from "@/lib/marketing/memory/customerInsightMemoryCli";
export {
  createPerformanceMemorySource,
  parsePerformanceMemoryLoadParams,
  PerformanceMemorySource,
} from "@/lib/marketing/memory/sources/performanceMemorySource";
export type {
  ParsedPerformanceMemoryLoadParams,
  PerformanceMemoryBundle,
  PerformanceMemoryLoadParams,
  PerformanceMemorySourceDeps,
} from "@/lib/marketing/memory/sources/performanceMemorySource";
export {
  buildPerformanceMemoryContent,
  mapPerformanceToMemoryDocument,
  performanceChannelKey,
  performanceMemoryConfidence,
  performanceMemoryExpiresAt,
  performanceMemoryImportance,
  performanceMemorySourceId,
  performanceWindowKey,
} from "@/lib/marketing/memory/performanceMemoryContent";
export { parsePerformanceMemoryCliArgs } from "@/lib/marketing/memory/performanceMemoryCli";
export type { PerformanceMemoryCliArgs } from "@/lib/marketing/memory/performanceMemoryCli";
export {
  createContentMemorySource,
  parseContentMemoryLoadParams,
  ContentMemorySource,
} from "@/lib/marketing/memory/sources/contentMemorySource";
export type {
  ContentMemoryBundle,
  ContentMemoryLoadParams,
  ContentMemorySourceDeps,
  ParsedContentMemoryLoadParams,
} from "@/lib/marketing/memory/sources/contentMemorySource";
export {
  buildContentMemoryContent,
  mapContentToMemoryDocument,
  stripHtmlToMemoryText,
} from "@/lib/marketing/memory/contentMemoryContent";
export { parseContentMemoryCliArgs } from "@/lib/marketing/memory/contentMemoryCli";
export type { ContentMemoryCliArgs } from "@/lib/marketing/memory/contentMemoryCli";
export { parseProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
export type { ProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
