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
  SemanticNotConfiguredError,
  SemanticProviderError,
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
export { createVectorMemoryRepository } from "@/lib/marketing/semantic/vectorMemoryRepository";
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
