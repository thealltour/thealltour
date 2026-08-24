import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ContextValidationError } from "@/lib/marketing/context/errors";
import {
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
  SemanticRepositoryError,
  createEmbeddingProvider,
  createVectorMemoryRepository,
  parseSemanticRetrievalRequest,
  semanticRetrieve,
} from "@/lib/marketing/semantic";
import type { VectorMemoryRepository } from "@/lib/marketing/semantic/types";

const dummyRepository: VectorMemoryRepository = {
  searchSimilar: async () => [],
};

const miniPcEnv = {
  EMBEDDING_PROVIDER: "mini_pc",
  EMBEDDING_BASE_URL: "http://embedding.test",
  EMBEDDING_MODEL: "BAAI/bge-m3",
  EMBEDDING_DIMENSION: "4",
};

describe("semantic retrieval contract", () => {
  it("validates the request", () => {
    expect(() => parseSemanticRetrievalRequest({ query: "   " })).toThrow(ContextValidationError);
    expect(() => parseSemanticRetrievalRequest({ query: "다낭", productId: "nope" })).toThrow(
      ContextValidationError,
    );
    expect(parseSemanticRetrievalRequest({ query: "부모님과 다낭", limit: 3 }).limit).toBe(3);
  });

  it("returns provider_not_configured without faking matches", async () => {
    const result = await semanticRetrieve(
      { query: "부모님과 다낭 여행에서 이동이 편한 상품" },
      { env: { EMBEDDING_PROVIDER: "none" } },
    );
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("provider_not_configured");
    expect(result.matches).toEqual([]);
    expect(createEmbeddingProvider({ EMBEDDING_PROVIDER: "none" })).toBeInstanceOf(NoneEmbeddingProvider);
  });

  it("does not call Mini PC when the vector repository is not configured", async () => {
    const embed = vi.fn(async () => [0.1, 0.2, 0.3, 0.4]);
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        env: miniPcEnv,
        provider: { model: "BAAI/bge-m3", embed, embedMany: async () => [] },
      },
    );
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("repository_not_configured");
    expect(result.matches).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
    expect(createVectorMemoryRepository({ env: miniPcEnv })).toBeNull();
    expect(createEmbeddingProvider(miniPcEnv)).toBeInstanceOf(HttpEmbeddingProvider);
  });

  it("embeds then searches and treats zero matches as success", async () => {
    const searchSimilar = vi.fn(async () => []);
    const embed = vi.fn(async () => [0.1, 0.2, 0.3, 0.4]);
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        env: { EMBEDDING_PROVIDER: "http" },
        provider: {
          model: "BAAI/bge-m3",
          embed,
          embedMany: async (texts) => texts.map(() => [0.1, 0.2, 0.3, 0.4]),
        },
        repository: { searchSimilar },
      },
    );
    expect(embed.mock.invocationCallOrder[0]).toBeLessThan(searchSimilar.mock.invocationCallOrder[0]!);
    expect(searchSimilar).toHaveBeenCalledWith({
      embedding: [0.1, 0.2, 0.3, 0.4],
      limit: 10,
      minScore: undefined,
      memoryTypes: undefined,
      sourceTypes: undefined,
      embeddingModel: "BAAI/bge-m3",
    });
    expect(result.status).toBe("ok");
    expect(result.matches).toEqual([]);
    expect(result.model).toBe("BAAI/bge-m3");
  });

  it("returns matches from the repository", async () => {
    const result = await semanticRetrieve(
      { query: "다낭", limit: 2, minScore: 0.3, memoryTypes: ["brand_knowledge"] },
      {
        env: { EMBEDDING_PROVIDER: "http" },
        provider: {
          model: "BAAI/bge-m3",
          embed: async () => [0.1, 0.2, 0.3, 0.4],
          embedMany: async () => [],
        },
        repository: {
          searchSimilar: async () => [
            {
              memoryId: "mem-1",
              score: 0.88,
              memory: {
                id: "mem-1",
                memoryType: "brand_knowledge",
                title: "다낭",
                content: "효도여행",
                sourceType: null,
                sourceId: null,
              },
              source: { sourceType: "memory", sourceTable: "ai_memory", sourceId: "mem-1" },
            },
          ],
        },
      },
    );
    expect(result.status).toBe("ok");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.score).toBe(0.88);
  });

  it("records provider_error without faking matches when embed fails", async () => {
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        env: { EMBEDDING_PROVIDER: "mini_pc" },
        repository: dummyRepository,
        provider: {
          model: "BAAI/bge-m3",
          embed: async () => {
            throw new Error("Mini PC offline");
          },
          embedMany: async () => {
            throw new Error("Mini PC offline");
          },
        },
      },
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("provider_error");
    expect(result.matches).toEqual([]);
  });

  it("records repository_error when search fails", async () => {
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        env: { EMBEDDING_PROVIDER: "http" },
        provider: {
          model: "BAAI/bge-m3",
          embed: async () => [0.1, 0.2, 0.3, 0.4],
          embedMany: async () => [],
        },
        repository: {
          searchSimilar: async () => {
            throw new SemanticRepositoryError("RPC failed");
          },
        },
      },
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("repository_error");
    expect(result.matches).toEqual([]);
  });

  it("skips unsupported productId and multi-value filters before embedding", async () => {
    const embed = vi.fn(async () => [0.1, 0.2, 0.3, 0.4]);
    const provider = { model: "BAAI/bge-m3", embed, embedMany: async () => [] };
    const product = await semanticRetrieve(
      { query: "다낭", productId: "11111111-1111-4111-8111-111111111111" },
      { env: miniPcEnv, provider, repository: dummyRepository },
    );
    expect(product.status).toBe("skipped");
    expect(product.reason).toBe("filter_unsupported");
    const multi = await semanticRetrieve(
      { query: "다낭", memoryTypes: ["brand_knowledge", "trend"] },
      { env: miniPcEnv, provider, repository: dummyRepository },
    );
    expect(multi.reason).toBe("filter_unsupported");
    expect(embed).not.toHaveBeenCalled();
  });
});
