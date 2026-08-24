import { describe, expect, it } from "vitest";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import {
  HttpEmbeddingProvider,
  createEmbeddingProvider,
  createVectorMemoryRepository,
  parseSemanticRetrievalRequest,
  semanticRetrieve,
} from "@/lib/marketing/semantic";
import type { VectorMemoryRepository } from "@/lib/marketing/semantic/types";

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
  });

  it("does not call a remote Mini PC endpoint in this step", async () => {
    const result = await semanticRetrieve(
      { query: "다낭" },
      { env: { EMBEDDING_PROVIDER: "mini_pc", EMBEDDING_HTTP_URL: "http://example.invalid" } },
    );
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("provider_unsupported");
    expect(createEmbeddingProvider({ EMBEDDING_PROVIDER: "mini_pc" })).toBeInstanceOf(HttpEmbeddingProvider);
  });

  it("exposes a vector repository contract without a DB implementation", async () => {
    expect(createVectorMemoryRepository()).toBeNull();
    const repository: VectorMemoryRepository = {
      searchSimilar: async () => [],
    };
    const result = await semanticRetrieve(
      { query: "다낭" },
      {
        provider: {
          model: "test",
          embed: async () => [0.1, 0.2],
          embedMany: async (texts) => texts.map(() => [0.1, 0.2]),
        },
        repository,
        env: { EMBEDDING_PROVIDER: "http" },
      },
    );
    expect(result.status).toBe("ok");
    expect(result.matches).toEqual([]);
  });
});
