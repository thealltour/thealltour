import { describe, expect, it } from "vitest";

import {
  MarketingSemanticValidationError,
  assertCosineSimilarityBound,
  assertFiniteEmbeddingVector,
  validateUpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/validation";

function vec(n: number, fill = 0.1): number[] {
  return Array.from({ length: n }, () => fill);
}

describe("marketing semantic record validation", () => {
  it("accepts a valid upsert payload with explicit revision + sourceTextVersion", () => {
    const validated = validateUpsertMarketingSemanticEmbeddingInput({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v10",
      contentHash: "a".repeat(64),
      sourceTextVersion: "v1",
      embedding: vec(4),
      metadata: { note: "ok" },
    });
    expect(validated.entityId).toBe("rb_1");
    expect(validated.revision).toBe("v10");
    expect(validated.sourceTextVersion).toBe("v1");
    expect(validated.embedding).toHaveLength(4);
  });

  it("rejects dimension mismatch vs vector length", () => {
    expect(() =>
      validateUpsertMarketingSemanticEmbeddingInput({
        entityType: "agenda_candidate",
        entityId: "ac_1",
        model: "BAAI/bge-m3",
        dimension: 8,
        revision: "1",
        contentHash: "b".repeat(64),
        sourceTextVersion: "v1",
        embedding: vec(4),
      }),
    ).toThrow(MarketingSemanticValidationError);
  });

  it("rejects NaN/Inf embeddings", () => {
    expect(() => assertFiniteEmbeddingVector([0.1, Number.NaN, 0.2, 0.3], 4)).toThrow(
      MarketingSemanticValidationError,
    );
    expect(() => assertFiniteEmbeddingVector([0.1, Number.POSITIVE_INFINITY, 0.2, 0.3], 4)).toThrow(
      MarketingSemanticValidationError,
    );
  });

  it("rejects invalid content hash, empty ids, and empty revision", () => {
    expect(() =>
      validateUpsertMarketingSemanticEmbeddingInput({
        entityType: "completed_marketing_candidate",
        entityId: " ",
        model: "BAAI/bge-m3",
        dimension: 4,
        revision: "1",
        contentHash: "not-a-hash",
        sourceTextVersion: "v1",
        embedding: vec(4),
      }),
    ).toThrow(MarketingSemanticValidationError);

    expect(() =>
      validateUpsertMarketingSemanticEmbeddingInput({
        entityType: "research_brief",
        entityId: "rb_1",
        model: "BAAI/bge-m3",
        dimension: 4,
        revision: "  ",
        contentHash: "c".repeat(64),
        sourceTextVersion: "v1",
        embedding: vec(4),
      }),
    ).toThrow(MarketingSemanticValidationError);
  });

  it("accepts negative minSimilarity within [-1, 1]", () => {
    expect(assertCosineSimilarityBound(-0.25, "minSimilarity")).toBe(-0.25);
    expect(() => assertCosineSimilarityBound(-1.01, "minSimilarity")).toThrow(
      MarketingSemanticValidationError,
    );
  });
});
