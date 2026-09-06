export type {
  AgendaCandidateEmbeddingTextInput,
  CompletedMarketingCandidateEmbeddingTextInput,
  MarketingSemanticEmbeddingRecord,
  MarketingSemanticEntityType,
  MarketingSemanticSimilarityMatch,
  MarketingSemanticSimilaritySearchParams,
  ResearchBriefEmbeddingTextInput,
  UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
export {
  DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
  MARKETING_SEMANTIC_ENTITY_TYPES,
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
export {
  MARKETING_SEMANTIC_DEFAULT_DIMENSION,
  MARKETING_SEMANTIC_DEFAULT_MODEL,
} from "@/lib/marketing/semantic/entityEmbeddings/constants";
export {
  buildAgendaCandidateCanonicalText,
  buildAgendaCandidateContentHash,
  buildCompletedMarketingCandidateCanonicalText,
  buildCompletedMarketingCandidateContentHash,
  buildResearchBriefCanonicalText,
  buildResearchBriefContentHash,
  hashMarketingSemanticSourceText,
} from "@/lib/marketing/semantic/entityEmbeddings/canonicalText";
export {
  MarketingSemanticValidationError,
  assertContentHash,
  assertCosineSimilarityBound,
  assertFiniteEmbeddingVector,
  assertNonEmptyString,
  assertPositiveInt,
  isMarketingSemanticEntityType,
  validateMarketingSemanticEmbeddingRecord,
  validateUpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/validation";
export type {
  GetMarketingSemanticEmbeddingParams,
  ListMarketingSemanticEmbeddingsByEntityIdsParams,
  MarketingSemanticEmbeddingRepository,
} from "@/lib/marketing/semantic/entityEmbeddings/repository";
export {
  InMemoryMarketingSemanticEmbeddingRepository,
  createInMemoryMarketingSemanticEmbeddingRepository,
  marketingSemanticCosineSimilarity,
} from "@/lib/marketing/semantic/entityEmbeddings/inMemorySemanticEmbeddingRepository";
export {
  createMarketingSemanticEmbeddingRepository,
  isMarketingSemanticEmbeddingRepositoryConfigured,
} from "@/lib/marketing/semantic/entityEmbeddings/createSemanticEmbeddingRepository";
