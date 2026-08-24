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
  SemanticUnsupportedError,
} from "@/lib/marketing/semantic/errors";
export {
  EMBEDDING_HTTP_URL_ENV,
  EMBEDDING_MODEL_ENV,
  EMBEDDING_PROVIDER_ENV,
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
  createEmbeddingProvider,
  readEmbeddingProviderKind,
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
