import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapAiMemoryRow } from "@/lib/marketing/context/mappers/memoryContextMapper";
import {
  MATCH_AI_MEMORY_RPC,
  SemanticFilterUnsupportedError,
  SemanticRepositoryError,
  SupabaseVectorMemoryRepository,
  createVectorMemoryRepository,
  serializePgVector,
} from "@/lib/marketing/semantic";
import type { VectorMemoryRpcClient } from "@/lib/marketing/semantic";

const MODEL = "BAAI/bge-m3";
const DIMENSION = 4;
const EMBEDDING = [0.1, 0.2, 0.3, 0.4];

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    memory_type: "brand_knowledge",
    title: "다낭",
    content: "부모님과 함께 가기 좋은 다낭 효도여행",
    source_type: null,
    source_id: null,
    importance: 0.8,
    confidence: 0.9,
    embedding_model: MODEL,
    created_at: "2026-08-25T00:00:00.000Z",
    updated_at: "2026-08-25T00:00:00.000Z",
    expires_at: null,
    similarity: 0.91,
    ...overrides,
  };
}

function createRepo(rpc: ReturnType<typeof vi.fn>) {
  return new SupabaseVectorMemoryRepository({
    client: { rpc: rpc as VectorMemoryRpcClient["rpc"] },
    model: MODEL,
    dimension: DIMENSION,
  });
}

function rpcArgs(rpc: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = rpc.mock.calls.at(0) as [string, Record<string, unknown>] | undefined;
  return call?.[1] ?? {};
}

describe("SupabaseVectorMemoryRepository", () => {
  it("returns null from the factory without a service role key", () => {
    expect(
      createVectorMemoryRepository({
        env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
      }),
    ).toBeNull();
  });

  it("maps RPC parameters and number[] embeddings", async () => {
    const rpc = vi.fn(async () => ({ data: [rpcRow()], error: null }));
    const matches = await createRepo(rpc).searchSimilar({
      embedding: EMBEDDING,
      limit: 7,
      minScore: 0.2,
      memoryTypes: ["brand_knowledge"],
      sourceTypes: ["product"],
      sourceId: "src-1",
      embeddingModel: MODEL,
    });

    expect(rpc).toHaveBeenCalledWith(MATCH_AI_MEMORY_RPC, {
      query_embedding: EMBEDDING,
      match_count: 7,
      min_similarity: 0.2,
      filter_memory_type: "brand_knowledge",
      filter_source_type: "product",
      filter_source_id: "src-1",
      filter_embedding_model: MODEL,
    });
    expect(Array.isArray(rpcArgs(rpc).query_embedding)).toBe(true);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.memoryId).toBe(rpcRow().id);
    expect(matches[0]?.score).toBe(0.91);
    expect(matches[0]?.memory).toEqual({
      id: rpcRow().id,
      memoryType: "brand_knowledge",
      title: "다낭",
      content: "부모님과 함께 가기 좋은 다낭 효도여행",
      sourceType: null,
      sourceId: null,
    });
    expect(mapAiMemoryRow(rpcRow())?.id).toBe(rpcRow().id);
  });

  it("defaults embedding_model and minScore from repository config", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    await createRepo(rpc).searchSimilar({ embedding: EMBEDDING, limit: 3 });
    expect(rpcArgs(rpc)).toMatchObject({
      min_similarity: 0,
      filter_embedding_model: MODEL,
      filter_memory_type: null,
      filter_source_type: null,
      filter_source_id: null,
    });
  });

  it("rejects multiple memoryTypes instead of silent shrink", async () => {
    const rpc = vi.fn();
    await expect(
      createRepo(rpc).searchSimilar({
        embedding: EMBEDDING,
        limit: 3,
        memoryTypes: ["brand_knowledge", "trend"],
      }),
    ).rejects.toBeInstanceOf(SemanticFilterUnsupportedError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects productId/campaignId filters", async () => {
    const rpc = vi.fn();
    await expect(
      createRepo(rpc).searchSimilar({
        embedding: EMBEDDING,
        limit: 3,
        productId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toBeInstanceOf(SemanticFilterUnsupportedError);
  });

  it("wraps RPC errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    await expect(createRepo(rpc).searchSimilar({ embedding: EMBEDDING, limit: 3 })).rejects.toBeInstanceOf(
      SemanticRepositoryError,
    );
  });

  it("rejects malformed rows and out-of-range similarity", async () => {
    const malformed = vi.fn(async () => ({ data: [{ hello: "world" }], error: null }));
    await expect(
      createRepo(malformed).searchSimilar({ embedding: EMBEDDING, limit: 3 }),
    ).rejects.toBeInstanceOf(SemanticRepositoryError);

    const badScore = vi.fn(async () => ({ data: [rpcRow({ similarity: 2 })], error: null }));
    await expect(
      createRepo(badScore).searchSimilar({ embedding: EMBEDDING, limit: 3 }),
    ).rejects.toBeInstanceOf(SemanticRepositoryError);

    const nonFinite = vi.fn(async () => ({ data: [rpcRow({ similarity: Number.NaN })], error: null }));
    await expect(
      createRepo(nonFinite).searchSimilar({ embedding: EMBEDDING, limit: 3 }),
    ).rejects.toBeInstanceOf(SemanticRepositoryError);
  });

  it("rejects invalid query embeddings without serializing them", async () => {
    const rpc = vi.fn();
    await expect(createRepo(rpc).searchSimilar({ embedding: [], limit: 1 })).rejects.toBeInstanceOf(
      SemanticRepositoryError,
    );
    await expect(
      createRepo(rpc).searchSimilar({ embedding: [0.1, Number.POSITIVE_INFINITY, 0.3, 0.4], limit: 1 }),
    ).rejects.toBeInstanceOf(SemanticRepositoryError);
    expect(serializePgVector(EMBEDDING)).toBe("[0.1,0.2,0.3,0.4]");
    expect(rpc).not.toHaveBeenCalled();
  });
});
