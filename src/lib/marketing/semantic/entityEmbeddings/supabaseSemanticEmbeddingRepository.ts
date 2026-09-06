import "server-only";

import { asNumber } from "@/lib/marketing/context/json";
import { DEFAULT_EMBEDDING_DIMENSION, DEFAULT_EMBEDDING_MODEL } from "@/lib/marketing/semantic/embeddingConfig";
import type {
  GetMarketingSemanticEmbeddingParams,
  ListMarketingSemanticEmbeddingsByEntityIdsParams,
  MarketingSemanticEmbeddingRepository,
} from "@/lib/marketing/semantic/entityEmbeddings/repository";
import type {
  MarketingSemanticEmbeddingRecord,
  MarketingSemanticSimilarityMatch,
  MarketingSemanticSimilaritySearchParams,
  UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
import {
  assertCosineSimilarityBound,
  isMarketingSemanticEntityType,
  validateUpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/validation";
import { SemanticRepositoryError } from "@/lib/marketing/semantic/errors";
import { assertQueryEmbedding, serializePgVector } from "@/lib/marketing/semantic/pgVector";

export const MATCH_MARKETING_SEMANTIC_EMBEDDINGS_RPC = "match_marketing_semantic_embeddings";
export const MARKETING_SEMANTIC_EMBEDDINGS_TABLE = "marketing_semantic_embeddings";

type DbClient = {
  from: (table: string) => unknown;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const SIMILARITY_EPSILON = 1e-6;

function parseSimilarity(value: unknown): number {
  const n = asNumber(value);
  if (n == null) {
    throw new SemanticRepositoryError("similarity is missing or not finite");
  }
  // Bound only for floating-point noise; preserve negatives in [-1, 1].
  if (n > 1 && n <= 1 + SIMILARITY_EPSILON) return 1;
  if (n < -1 && n >= -1 - SIMILARITY_EPSILON) return -1;
  if (n < -1 || n > 1) {
    throw new SemanticRepositoryError("similarity is out of range [-1, 1]");
  }
  return n;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SemanticRepositoryError("marketing_semantic_embeddings row is malformed");
  }
  return value as Record<string, unknown>;
}

function parseEmbeddingColumn(embeddingRaw: unknown): number[] {
  if (typeof embeddingRaw === "string") {
    const trimmed = embeddingRaw.trim().replace(/^\[/, "").replace(/\]$/, "");
    return trimmed.split(",").map((part) => Number(part.trim()));
  }
  if (Array.isArray(embeddingRaw)) {
    return embeddingRaw.map((n) => Number(n));
  }
  throw new SemanticRepositoryError("embedding is missing");
}

function mapRow(value: unknown): MarketingSemanticEmbeddingRecord {
  const row = asRecord(value);
  const entityType = row.entity_type;
  if (!isMarketingSemanticEntityType(entityType)) {
    throw new SemanticRepositoryError("entity_type is invalid");
  }
  const embedding = parseEmbeddingColumn(row.embedding);
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id ?? ""),
    entityType,
    entityId: String(row.entity_id ?? ""),
    model: String(row.embedding_model ?? ""),
    dimension: Number(row.embedding_dimension ?? embedding.length),
    revision: String(row.embedding_revision ?? ""),
    contentHash: String(row.content_hash ?? ""),
    sourceTextVersion: String(row.source_text_version ?? ""),
    embedding,
    metadata,
    embeddedAt: String(row.embedded_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export class SupabaseMarketingSemanticEmbeddingRepository
  implements MarketingSemanticEmbeddingRepository
{
  private readonly client: DbClient;
  readonly defaultModel: string;
  readonly defaultDimension: number;

  constructor(input: {
    client: DbClient;
    defaultModel?: string;
    defaultDimension?: number;
  }) {
    this.client = input.client;
    this.defaultModel = input.defaultModel?.trim() || DEFAULT_EMBEDDING_MODEL;
    this.defaultDimension = input.defaultDimension ?? DEFAULT_EMBEDDING_DIMENSION;
  }

  async upsert(input: UpsertMarketingSemanticEmbeddingInput): Promise<MarketingSemanticEmbeddingRecord> {
    const validated = validateUpsertMarketingSemanticEmbeddingInput(input, {
      expectedDimension: this.defaultDimension,
    });
    const now = new Date().toISOString();
    const payload = {
      entity_type: validated.entityType,
      entity_id: validated.entityId,
      embedding_model: validated.model,
      embedding_dimension: validated.dimension,
      embedding_revision: validated.revision,
      content_hash: validated.contentHash,
      source_text_version: validated.sourceTextVersion,
      embedding: serializePgVector(validated.embedding),
      metadata: validated.metadata ?? {},
      embedded_at: validated.embeddedAt ?? now,
      updated_at: now,
    };

    const query = this.client.from(MARKETING_SEMANTIC_EMBEDDINGS_TABLE) as {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string },
      ) => {
        select: (
          columns?: string,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };

    const { data, error } = await query
      .upsert(payload, {
        onConflict:
          "entity_type,entity_id,embedding_model,embedding_revision,source_text_version",
      })
      .select("*");
    if (error) throw new SemanticRepositoryError(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new SemanticRepositoryError("upsert returned no row");
    return mapRow(row);
  }

  async get(
    params: GetMarketingSemanticEmbeddingParams,
  ): Promise<MarketingSemanticEmbeddingRecord | null> {
    const base = this.client.from(MARKETING_SEMANTIC_EMBEDDINGS_TABLE) as {
      select: (columns?: string) => {
        eq: (column: string, value: unknown) => any;
      };
    };

    const { data, error } = await base
      .select("*")
      .eq("entity_type", params.entityType)
      .eq("entity_id", params.entityId)
      .eq("embedding_model", params.model)
      .eq("embedding_revision", params.revision)
      .eq("source_text_version", params.sourceTextVersion)
      .maybeSingle();
    if (error) throw new SemanticRepositoryError(error.message);
    return data ? mapRow(data) : null;
  }

  async listByEntityIds(
    params: ListMarketingSemanticEmbeddingsByEntityIdsParams,
  ): Promise<MarketingSemanticEmbeddingRecord[]> {
    if (params.entityIds.length === 0) return [];
    const base = this.client.from(MARKETING_SEMANTIC_EMBEDDINGS_TABLE) as {
      select: (columns?: string) => {
        eq: (column: string, value: unknown) => any;
      };
    };

    const { data, error } = await base
      .select("*")
      .eq("entity_type", params.entityType)
      .eq("embedding_model", params.model)
      .eq("embedding_revision", params.revision)
      .eq("source_text_version", params.sourceTextVersion)
      .in("entity_id", params.entityIds);
    if (error) throw new SemanticRepositoryError(error.message);
    return Array.isArray(data) ? data.map(mapRow) : [];
  }

  async searchSimilar(
    params: MarketingSemanticSimilaritySearchParams,
  ): Promise<MarketingSemanticSimilarityMatch[]> {
    const queryEmbedding = assertQueryEmbedding(params.embedding, this.defaultDimension);
    const minSimilarity = assertCosineSimilarityBound(params.minSimilarity ?? -1, "minSimilarity");
    const { data, error } = await this.client.rpc(MATCH_MARKETING_SEMANTIC_EMBEDDINGS_RPC, {
      query_embedding: queryEmbedding,
      match_count: params.limit ?? 20,
      min_similarity: minSimilarity,
      filter_entity_type: params.entityType ?? null,
      filter_embedding_model: params.model ?? this.defaultModel,
      filter_embedding_revision: params.revision ?? null,
      filter_source_text_version: params.sourceTextVersion ?? null,
      exclude_entity_ids: params.excludeEntityIds ?? null,
    });
    if (error) throw new SemanticRepositoryError(error.message);
    if (!Array.isArray(data)) return [];
    return data.map((row) => ({
      record: mapRow(row),
      similarity: parseSimilarity(asRecord(row).similarity),
    }));
  }
}
