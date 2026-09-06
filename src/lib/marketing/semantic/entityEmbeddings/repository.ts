import type {
  MarketingSemanticEmbeddingRecord,
  MarketingSemanticEntityType,
  MarketingSemanticSimilarityMatch,
  MarketingSemanticSimilaritySearchParams,
  UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";

/** Canonical lookup — all identity fields required (no implicit latest). */
export type GetMarketingSemanticEmbeddingParams = {
  entityType: MarketingSemanticEntityType;
  entityId: string;
  model: string;
  revision: string;
  sourceTextVersion: string;
};

export type ListMarketingSemanticEmbeddingsByEntityIdsParams = {
  entityType: MarketingSemanticEntityType;
  entityIds: string[];
  model: string;
  revision: string;
  sourceTextVersion: string;
};

/**
 * Durable marketing entity embedding store.
 * Similarity: cosine similarity in [-1, 1], higher = more similar.
 */
export interface MarketingSemanticEmbeddingRepository {
  upsert(input: UpsertMarketingSemanticEmbeddingInput): Promise<MarketingSemanticEmbeddingRecord>;

  get(
    params: GetMarketingSemanticEmbeddingParams,
  ): Promise<MarketingSemanticEmbeddingRecord | null>;

  listByEntityIds(
    params: ListMarketingSemanticEmbeddingsByEntityIdsParams,
  ): Promise<MarketingSemanticEmbeddingRecord[]>;

  searchSimilar(
    params: MarketingSemanticSimilaritySearchParams,
  ): Promise<MarketingSemanticSimilarityMatch[]>;
}
