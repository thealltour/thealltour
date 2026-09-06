import { describe, expect, it } from "vitest";

import {
  createInMemoryMarketingSemanticEmbeddingRepository,
  marketingSemanticCosineSimilarity,
} from "@/lib/marketing/semantic/entityEmbeddings/inMemorySemanticEmbeddingRepository";

function unitish(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

describe("InMemoryMarketingSemanticEmbeddingRepository", () => {
  it("upserts idempotently for the same identity tuple", async () => {
    const repo = createInMemoryMarketingSemanticEmbeddingRepository();
    const first = await repo.upsert({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "c".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([1, 0, 0, 0]),
    });
    const second = await repo.upsert({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "d".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([0, 1, 0, 0]),
    });
    expect(second.id).toBe(first.id);
    expect(second.contentHash).toBe("d".repeat(64));
  });

  it("keeps embedding revisions and source text versions as coexisting identities", async () => {
    const repo = createInMemoryMarketingSemanticEmbeddingRepository();
    await repo.upsert({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v9",
      contentHash: "1".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([1, 0, 0, 0]),
    });
    await repo.upsert({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v10",
      contentHash: "2".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([0, 1, 0, 0]),
    });
    await repo.upsert({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v10",
      contentHash: "3".repeat(64),
      sourceTextVersion: "v2",
      embedding: unitish([0, 0, 1, 0]),
    });

    // Explicit lookup only — never lexical "max" of v9/v10
    const v9 = await repo.get({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      revision: "v9",
      sourceTextVersion: "v1",
    });
    const v10v1 = await repo.get({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      revision: "v10",
      sourceTextVersion: "v1",
    });
    const v10v2 = await repo.get({
      entityType: "research_brief",
      entityId: "rb_1",
      model: "BAAI/bge-m3",
      revision: "v10",
      sourceTextVersion: "v2",
    });

    expect(v9?.contentHash).toBe("1".repeat(64));
    expect(v10v1?.contentHash).toBe("2".repeat(64));
    expect(v10v2?.contentHash).toBe("3".repeat(64));
    expect(v9?.id).not.toBe(v10v1?.id);
    expect(v10v1?.id).not.toBe(v10v2?.id);

    // Lexical trap: "v9" > "v10" as strings — repository must not use that ordering.
    expect("v9" > "v10").toBe(true);
  });

  it("orders similarity descending, preserves negatives, and honors filters", async () => {
    const repo = createInMemoryMarketingSemanticEmbeddingRepository();
    const query = unitish([1, 0, 0, 0]);
    await repo.upsert({
      entityType: "agenda_candidate",
      entityId: "near",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "1".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([0.99, 0.1, 0, 0]),
    });
    await repo.upsert({
      entityType: "agenda_candidate",
      entityId: "mid",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "2".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([0.5, 0.5, 0, 0]),
    });
    await repo.upsert({
      entityType: "agenda_candidate",
      entityId: "opposite",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "3".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([-1, 0, 0, 0]),
    });
    await repo.upsert({
      entityType: "research_brief",
      entityId: "other_type",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "1",
      contentHash: "4".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([1, 0, 0, 0]),
    });

    const ranked = await repo.searchSimilar({
      embedding: query,
      entityType: "agenda_candidate",
      model: "BAAI/bge-m3",
      revision: "1",
      sourceTextVersion: "v1",
      limit: 3,
      excludeEntityIds: ["mid"],
    });
    expect(ranked.map((row) => row.record.entityId)).toEqual(["near", "opposite"]);
    expect(ranked[0]!.similarity).toBeGreaterThan(ranked[1]!.similarity);
    expect(ranked[1]!.similarity).toBeLessThan(0);

    const filtered = await repo.searchSimilar({
      embedding: query,
      entityType: "agenda_candidate",
      model: "BAAI/bge-m3",
      revision: "1",
      sourceTextVersion: "v1",
      minSimilarity: 0.9,
    });
    expect(filtered.every((row) => row.similarity >= 0.9)).toBe(true);
    expect(filtered.map((row) => row.record.entityId)).toEqual(["near"]);

    const includeNegative = await repo.searchSimilar({
      embedding: query,
      entityType: "agenda_candidate",
      model: "BAAI/bge-m3",
      revision: "1",
      sourceTextVersion: "v1",
      minSimilarity: -1,
    });
    expect(includeNegative.some((row) => row.record.entityId === "opposite")).toBe(true);
    expect(includeNegative.find((row) => row.record.entityId === "opposite")!.similarity).toBeLessThan(
      0,
    );

    const excludeStrongNegative = await repo.searchSimilar({
      embedding: query,
      entityType: "agenda_candidate",
      model: "BAAI/bge-m3",
      revision: "1",
      sourceTextVersion: "v1",
      minSimilarity: -0.5,
    });
    expect(excludeStrongNegative.some((row) => row.record.entityId === "opposite")).toBe(false);
  });

  it("lists by entity ids with explicit revision + sourceTextVersion only", async () => {
    const repo = createInMemoryMarketingSemanticEmbeddingRepository();
    await repo.upsert({
      entityType: "completed_marketing_candidate",
      entityId: "cmc_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v9",
      contentHash: "a".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([1, 0, 0, 0]),
    });
    await repo.upsert({
      entityType: "completed_marketing_candidate",
      entityId: "cmc_1",
      model: "BAAI/bge-m3",
      dimension: 4,
      revision: "v10",
      contentHash: "b".repeat(64),
      sourceTextVersion: "v1",
      embedding: unitish([0, 1, 0, 0]),
    });
    const listed = await repo.listByEntityIds({
      entityType: "completed_marketing_candidate",
      entityIds: ["cmc_1", "missing"],
      model: "BAAI/bge-m3",
      revision: "v10",
      sourceTextVersion: "v1",
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.revision).toBe("v10");
    expect(listed[0]?.contentHash).toBe("b".repeat(64));
  });

  it("computes true cosine similarity including negatives", () => {
    const a = unitish([1, 0, 0, 0]);
    const b = unitish([-1, 0, 0, 0]);
    expect(marketingSemanticCosineSimilarity(a, a)).toBeCloseTo(1, 6);
    expect(marketingSemanticCosineSimilarity(a, b)).toBeCloseTo(-1, 6);
  });
});
