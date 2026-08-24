import { describe, expect, it } from "vitest";
import { rankContextCandidates } from "@/lib/marketing/scoring/rankContextCandidates";
import { selectScoredContext } from "@/lib/marketing/scoring/selectScoredContext";
import type { ScoredContextCandidate } from "@/lib/marketing/scoring/types";
import { NOW, PRODUCT_ID, candidate, contentItem, createContentRequest, emptyRetrieval } from "./fixtures";

function scored(
  id: string,
  score: { total: number; freshness: number; relevance: number },
): ScoredContextCandidate {
  return {
    ...candidate("contentHistory", contentItem({ id, sourceId: id })),
    id,
    score: {
      relevance: score.relevance,
      freshness: score.freshness,
      reliability: 0.5,
      businessImportance: 0.5,
      total: score.total,
    },
  };
}

describe("ranking", () => {
  it("sorts by total, then freshness, then relevance", () => {
    const ranked = rankContextCandidates([
      scored("a", { total: 0.5, freshness: 0.9, relevance: 0.9 }),
      scored("b", { total: 0.8, freshness: 0.1, relevance: 0.1 }),
      scored("c", { total: 0.5, freshness: 0.9, relevance: 0.2 }),
      scored("d", { total: 0.5, freshness: 0.4, relevance: 1 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("breaks remaining ties by id", () => {
    const ranked = rankContextCandidates([
      scored("z", { total: 0.5, freshness: 0.5, relevance: 0.5 }),
      scored("m", { total: 0.5, freshness: 0.5, relevance: 0.5 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["m", "z"]);
  });

  it("keeps only the context top-K after scoring", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      contentItem({
        id: `c${index}`,
        sourceId: `c${index}`,
        publishedAt: new Date(Date.parse(NOW) - index * 86_400_000).toISOString(),
        productId: PRODUCT_ID,
      }),
    );
    const selected = selectScoredContext(
      emptyRetrieval({ contentHistory: items, sources: [] }),
      createContentRequest,
      { contextLimit: 3, now: new Date(NOW) },
    );
    expect(selected.selected).toHaveLength(3);
    expect(selected.retrieval.contentHistory).toHaveLength(3);
    expect(selected.candidates).toHaveLength(8);
  });
});
