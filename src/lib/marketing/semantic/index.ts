export type { EmbeddingVector, EmbeddingProvider } from "@/lib/marketing/semantic/types";
export type {
  ParsedSemanticRetrievalRequest,
  SemanticContextStatus,
  SemanticMemoryMatch,
  SemanticRetrievalRequest,
  SemanticRetrievalResult,
  SemanticSkipReason,
  VectorMemoryRepository,
  VectorSimilaritySearchParams,
} from "@/lib/marketing/semantic/types";
export {
  SemanticFilterUnsupportedError,
  SemanticNotConfiguredError,
  SemanticProviderError,
  SemanticRepositoryError,
  SemanticTimeoutError,
  SemanticUnsupportedError,
} from "@/lib/marketing/semantic/errors";
export {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_TIMEOUT_MS,
  EMBEDDING_API_TOKEN_ENV,
  EMBEDDING_BASE_URL_ENV,
  EMBEDDING_DIMENSION_ENV,
  EMBEDDING_HTTP_URL_ENV,
  EMBEDDING_MODEL_ENV,
  EMBEDDING_PROVIDER_ENV,
  EMBEDDING_TIMEOUT_MS_ENV,
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
  checkEmbeddingHealth,
  createEmbeddingProvider,
  parseEmbeddingConfig,
  parseEmbeddingHttpConfig,
  readEmbeddingProviderKind,
} from "@/lib/marketing/semantic/embeddingProvider";
export type {
  EmbeddingHealth,
  EmbeddingHttpConfig,
  EmbeddingProviderKind,
  ParsedEmbeddingConfig,
} from "@/lib/marketing/semantic/embeddingProvider";
export { createVectorMemoryRepository, isVectorMemoryRepositoryConfigured } from "@/lib/marketing/semantic/vectorMemoryRepository";
export {
  MATCH_AI_MEMORY_RPC,
  SupabaseVectorMemoryRepository,
  readVectorMemoryRepositoryConfig,
} from "@/lib/marketing/semantic/supabaseVectorMemoryRepository";
export type { VectorMemoryRpcClient } from "@/lib/marketing/semantic/supabaseVectorMemoryRepository";
export { assertQueryEmbedding, serializePgVector } from "@/lib/marketing/semantic/pgVector";
export {
  DEFAULT_SEMANTIC_LIMIT,
  MAX_SEMANTIC_LIMIT,
  parseSemanticRetrievalRequest,
} from "@/lib/marketing/semantic/validateSemanticRequest";
export {
  semanticRetrieve,
  semanticStatusFromResult,
  resolveSemanticContextStatus,
} from "@/lib/marketing/semantic/semanticRetrieve";
export type { SemanticRetrieveDeps } from "@/lib/marketing/semantic/semanticRetrieve";

/** Entity embedding store foundation (STEP E-1). Dormant — no Agenda wiring. */
export {
  DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
  MARKETING_SEMANTIC_ENTITY_TYPES,
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
  MarketingSemanticValidationError,
  buildAgendaCandidateCanonicalText,
  buildAgendaCandidateContentHash,
  buildCompletedMarketingCandidateCanonicalText,
  buildCompletedMarketingCandidateContentHash,
  buildResearchBriefCanonicalText,
  buildResearchBriefContentHash,
  createInMemoryMarketingSemanticEmbeddingRepository,
  createMarketingSemanticEmbeddingRepository,
  hashMarketingSemanticSourceText,
  isMarketingSemanticEmbeddingRepositoryConfigured,
  isMarketingSemanticEntityType,
  marketingSemanticCosineSimilarity,
  validateMarketingSemanticEmbeddingRecord,
  validateUpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings";
export type {
  AgendaCandidateEmbeddingTextInput,
  CompletedMarketingCandidateEmbeddingTextInput,
  GetMarketingSemanticEmbeddingParams,
  ListMarketingSemanticEmbeddingsByEntityIdsParams,
  MarketingSemanticEmbeddingRecord,
  MarketingSemanticEmbeddingRepository,
  MarketingSemanticEntityType,
  MarketingSemanticSimilarityMatch,
  MarketingSemanticSimilaritySearchParams,
  ResearchBriefEmbeddingTextInput,
  UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings";

/** Controlled semantic indexing (STEP E-2). Manual/CLI only — no Agenda wiring. */
export {
  DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH,
  assertMarketingSemanticSchemaReady,
  createSemanticIndexingRuntime,
  hydrateSemanticEntityForIndexing,
  indexSemanticEntitiesBatch,
  indexSemanticEntity,
  isMarketingSemanticSchemaMissingError,
  resolveMarketingSemanticIndexingConfig,
} from "@/lib/marketing/semantic/indexing";
export type {
  CreateSemanticIndexingRuntimeOptions,
  HydratedSemanticEntity,
  IndexSemanticEntitiesBatchInput,
  IndexSemanticEntityDeps,
  IndexSemanticEntityInput,
  MarketingSemanticIndexingConfig,
  SemanticEntityHydrationDeps,
  SemanticEntityHydrationResult,
  SemanticIndexResult,
  SemanticIndexStatus,
  SemanticIndexingRuntime,
} from "@/lib/marketing/semantic/indexing";
