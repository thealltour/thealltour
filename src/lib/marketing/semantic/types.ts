export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  readonly model: string;
  embed(text: string): Promise<EmbeddingVector>;
  embedMany(texts: string[]): Promise<EmbeddingVector[]>;
}

export type SemanticRetrievalRequest = {
  query: string;
  limit?: number;
  minScore?: number;
  memoryTypes?: string[];
  sourceTypes?: string[];
  productId?: string;
  campaignId?: string;
};

export type ParsedSemanticRetrievalRequest = SemanticRetrievalRequest & {
  query: string;
  limit: number;
};

export type SemanticSkipReason =
  | "provider_not_configured"
  | "provider_unsupported"
  | "repository_not_configured"
  | "provider_error";

export type SemanticMemoryMatch = {
  memoryId: string;
  score: number;
  memory: {
    id: string;
    memoryType: string;
    title: string | null;
    content: string;
    sourceType: string | null;
    sourceId: string | null;
  };
  source: {
    sourceType: "memory";
    sourceTable: "ai_memory";
    sourceId: string;
  };
};

export type VectorSimilaritySearchParams = {
  embedding: EmbeddingVector;
  limit: number;
  minScore?: number;
  memoryTypes?: string[];
  sourceTypes?: string[];
  productId?: string;
  campaignId?: string;
};

export interface VectorMemoryRepository {
  searchSimilar(params: VectorSimilaritySearchParams): Promise<SemanticMemoryMatch[]>;
}

export type SemanticRetrievalResult = {
  status: "ok" | "skipped" | "failed";
  reason?: SemanticSkipReason;
  matches: SemanticMemoryMatch[];
  model?: string;
};

export type SemanticContextStatus = {
  status: "skipped" | "ok" | "failed";
  reason?: SemanticSkipReason;
};
