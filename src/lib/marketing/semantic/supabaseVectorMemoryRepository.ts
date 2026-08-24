import "server-only";

import { asNumber } from "@/lib/marketing/context/json";
import { mapAiMemoryRow } from "@/lib/marketing/context/mappers/memoryContextMapper";
import { DEFAULT_EMBEDDING_DIMENSION, DEFAULT_EMBEDDING_MODEL, parseEmbeddingConfig } from "@/lib/marketing/semantic/embeddingConfig";
import { SemanticFilterUnsupportedError, SemanticRepositoryError } from "@/lib/marketing/semantic/errors";
import { assertQueryEmbedding } from "@/lib/marketing/semantic/pgVector";
import type {
  SemanticMemoryMatch,
  VectorMemoryRepository,
  VectorSimilaritySearchParams,
} from "@/lib/marketing/semantic/types";

export const MATCH_AI_MEMORY_RPC = "match_ai_memory";

export type VectorMemoryRpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type SupabaseVectorMemoryRepositoryOptions = {
  client: VectorMemoryRpcClient;
  model: string;
  dimension: number;
};

const SIMILARITY_EPSILON = 1e-6;

function singleOrUnsupported(values: string[] | undefined, label: string): string | null {
  if (values == null || values.length === 0) return null;
  if (values.length > 1) {
    throw new SemanticFilterUnsupportedError(`${label} does not support multiple values in v1`);
  }
  return values[0] ?? null;
}

function parseSimilarity(value: unknown): number {
  const n = asNumber(value);
  if (n == null) {
    throw new SemanticRepositoryError("match_ai_memory similarity is missing or not finite");
  }
  if (n > 1 && n <= 1 + SIMILARITY_EPSILON) return 1;
  if (n < 0 && n >= -SIMILARITY_EPSILON) return 0;
  if (n < 0 || n > 1) {
    throw new SemanticRepositoryError("match_ai_memory similarity is out of range");
  }
  return n;
}

function toSemanticMemoryMatch(row: unknown): SemanticMemoryMatch {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new SemanticRepositoryError("match_ai_memory row is malformed");
  }
  const record = row as Record<string, unknown>;
  const memory = mapAiMemoryRow(record);
  if (!memory) {
    throw new SemanticRepositoryError("match_ai_memory row is missing required memory fields");
  }
  const score = parseSimilarity(record.similarity);
  return {
    memoryId: memory.id,
    score,
    memory: {
      id: memory.id,
      memoryType: memory.memoryType,
      title: memory.title,
      content: memory.content,
      sourceType: memory.sourceType,
      sourceId: memory.sourceId,
    },
    source: {
      sourceType: "memory",
      sourceTable: "ai_memory",
      sourceId: memory.id,
    },
  };
}

export function readVectorMemoryRepositoryConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { model: string; dimension: number } {
  const parsed = parseEmbeddingConfig(env);
  if (parsed.kind === "mini_pc" || parsed.kind === "http") {
    return { model: parsed.model, dimension: parsed.dimension };
  }
  return { model: DEFAULT_EMBEDDING_MODEL, dimension: DEFAULT_EMBEDDING_DIMENSION };
}

export class SupabaseVectorMemoryRepository implements VectorMemoryRepository {
  private readonly client: VectorMemoryRpcClient;
  readonly model: string;
  readonly dimension: number;

  constructor(options: SupabaseVectorMemoryRepositoryOptions) {
    this.client = options.client;
    this.model = options.model.trim() || DEFAULT_EMBEDDING_MODEL;
    this.dimension = options.dimension;
  }

  async searchSimilar(params: VectorSimilaritySearchParams): Promise<SemanticMemoryMatch[]> {
    if (params.productId || params.campaignId) {
      throw new SemanticFilterUnsupportedError(
        "productId/campaignId semantic filters are unsupported until ai_memory source conventions exist",
      );
    }

    const queryEmbedding = assertQueryEmbedding(params.embedding, this.dimension);
    const filterMemoryType = singleOrUnsupported(params.memoryTypes, "memoryTypes");
    const filterSourceType = singleOrUnsupported(params.sourceTypes, "sourceTypes");
    const { data, error } = await this.client.rpc(MATCH_AI_MEMORY_RPC, {
      query_embedding: queryEmbedding,
      match_count: params.limit,
      min_similarity: params.minScore ?? 0,
      filter_memory_type: filterMemoryType,
      filter_source_type: filterSourceType,
      filter_source_id: params.sourceId?.trim() || null,
      filter_embedding_model: params.embeddingModel?.trim() || this.model,
    });

    if (error) {
      throw new SemanticRepositoryError(error.message || "match_ai_memory RPC failed");
    }
    if (data == null) return [];
    if (!Array.isArray(data)) {
      throw new SemanticRepositoryError("match_ai_memory response is not an array");
    }
    return data.map((row) => toSemanticMemoryMatch(row));
  }
}
