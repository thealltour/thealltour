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
export { createSupabaseMemoryStore } from "@/lib/marketing/memory/memoryStore";
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
export { parseProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
export type { ProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
