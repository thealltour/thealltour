import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

export const MARKETING_SEMANTIC_ENTITY_TYPES = [
  "research_brief",
  "agenda_candidate",
  "completed_marketing_candidate",
] as const;

export type MarketingSemanticEntityType = (typeof MARKETING_SEMANTIC_ENTITY_TYPES)[number];

/** Canonical source-text contract version for embedding input. */
export const MARKETING_SEMANTIC_SOURCE_TEXT_VERSION = "v1" as const;

/**
 * Default embedding pipeline revision identity.
 * Explicit string — never infer "latest" via lexical/numeric ordering.
 */
export const DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION = "1" as const;

export type MarketingSemanticEmbeddingRecord = {
  id: string;
  entityType: MarketingSemanticEntityType;
  entityId: string;
  model: string;
  dimension: number;
  /** Embedding pipeline / model-configuration revision (explicit text). */
  revision: string;
  contentHash: string;
  /** Canonical text schema version (distinct from revision). */
  sourceTextVersion: string;
  embedding: EmbeddingVector;
  metadata: Record<string, unknown>;
  embeddedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMarketingSemanticEmbeddingInput = {
  entityType: MarketingSemanticEntityType;
  entityId: string;
  model: string;
  dimension: number;
  revision: string;
  contentHash: string;
  sourceTextVersion: string;
  embedding: EmbeddingVector;
  metadata?: Record<string, unknown>;
  embeddedAt?: string;
};

export type MarketingSemanticSimilarityMatch = {
  record: MarketingSemanticEmbeddingRecord;
  /** Cosine similarity in [-1, 1]. Higher = more similar. */
  similarity: number;
};

export type MarketingSemanticSimilaritySearchParams = {
  embedding: EmbeddingVector;
  limit?: number;
  /** Inclusive minimum cosine similarity in [-1, 1]. */
  minSimilarity?: number;
  entityType?: MarketingSemanticEntityType;
  model?: string;
  revision?: string;
  sourceTextVersion?: string;
  excludeEntityIds?: string[];
};

/** Inputs for deterministic research_brief canonical text. */
export type ResearchBriefEmbeddingTextInput = {
  title: string;
  summary: string;
  destinations?: string[];
  topics?: string[];
  claims?: string[];
  practicalImplications?: string[];
};

/** Inputs for agenda_candidate / slate-item style editorial text. */
export type AgendaCandidateEmbeddingTextInput = {
  title: string;
  summary?: string | null;
  whyNow?: string | null;
  koreanTravelerRelevance?: string | null;
  practicalValue?: string | null;
  theAllTourRelevance?: string | null;
  destinations?: string[];
  topics?: string[];
};

/** Inputs for completed marketing candidate draft text. */
export type CompletedMarketingCandidateEmbeddingTextInput = {
  title?: string | null;
  topic?: string | null;
  channel?: string | null;
  contentType?: string | null;
  body: string;
  keyClaims?: string[];
};
