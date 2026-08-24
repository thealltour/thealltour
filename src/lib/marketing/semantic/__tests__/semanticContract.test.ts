import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ContextValidationError } from "@/lib/marketing/context/errors";
import {
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
  createEmbeddingProvider,
  createVectorMemoryRepository,
  parseSemanticRetrievalRequest,
  semanticRetrieve,
} from "@/lib/marketing/semantic";
import type { VectorMemoryRepository } from "@/lib/marketing/semantic/types";

const dummyRepository: VectorMemoryRepository = {
  searchSimilar: async () => [],
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
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        env: {
          EMBEDDING_PROVIDER: "mini_pc",
          EMBEDDING_BASE_URL: "http://embedding.test",
          EMBEDDING_MODEL: "BAAI/bge-m3",
          EMBEDDING_DIMENSION: "4",
        },
      },
    );
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("repository_not_configured");
    expect(result.matches).toEqual([]);
    expect(
      createEmbeddingProvider({
        EMBEDDING_PROVIDER: "mini_pc",
        EMBEDDING_BASE_URL: "http://embedding.test",
      }),
    ).toBeInstanceOf(HttpEmbeddingProvider);
  });

  it("exposes a vector repository contract without a DB implementation", async () => {
    expect(createVectorMemoryRepository()).toBeNull();
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        provider: {
          model: "test",
          embed: async () => [0.1, 0.2],
          embedMany: async (texts) => texts.map(() => [0.1, 0.2]),
        },
        repository: dummyRepository,
        env: { EMBEDDING_PROVIDER: "http" },
      },
    );
    expect(result.status).toBe("ok");
    expect(result.matches).toEqual([]);
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
});
