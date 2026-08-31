import { describe, expect, it } from "vitest";
import { resolveSearchTaxonomyIntent } from "@/lib/search/resolveSearchTaxonomyIntent";
import {
  buildSearchCandidateRanges,
  compareSearchRankCandidates,
  mapRowToSearchRankCandidate,
  rankSearchCandidates,
  relevanceScore,
  SEARCH_RELEVANCE_CHUNK_SIZE,
  sliceRankedCandidatePage,
  type SearchRankCandidate,
} from "@/lib/search/searchRelevanceCandidates";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function tax(
  partial: Partial<ProductTaxonomy> & Pick<ProductTaxonomy, "id" | "name" | "taxonomy_type">,
): ProductTaxonomy {
  return {
    slug: null,
    is_active: true,
    sort_order: 0,
    created_at: null,
    parent_id: null,
    is_hub_visible: true,
    is_landing_enabled: true,
    ...partial,
  };
}

const destinations = [
  tax({ id: "jp", name: "일본", taxonomy_type: "destination" }),
  tax({ id: "osaka", name: "오사카", taxonomy_type: "destination", parent_id: "jp" }),
];

const taxonomyContext = { destinations, themes: [], productLines: [] };

function candidate(
  partial: Partial<SearchRankCandidate> & Pick<SearchRankCandidate, "id" | "title">,
): SearchRankCandidate {
  return {
    category: "",
    ...partial,
  };
}

describe("buildSearchCandidateRanges", () => {
  it("returns empty for total 0", () => {
    expect(buildSearchCandidateRanges(0, 200)).toEqual([]);
  });

  it("single row", () => {
    expect(buildSearchCandidateRanges(1, 200)).toEqual([{ from: 0, to: 0 }]);
  });

  it("exact chunk boundary 200", () => {
    expect(buildSearchCandidateRanges(200, 200)).toEqual([{ from: 0, to: 199 }]);
  });

  it("201 → two chunks", () => {
    expect(buildSearchCandidateRanges(201, 200)).toEqual([
      { from: 0, to: 199 },
      { from: 200, to: 200 },
    ]);
  });

  it("537 → three chunks", () => {
    expect(buildSearchCandidateRanges(537, 200)).toEqual([
      { from: 0, to: 199 },
      { from: 200, to: 399 },
      { from: 400, to: 536 },
    ]);
  });

  it("500 → three chunks", () => {
    expect(buildSearchCandidateRanges(500, 200)).toEqual([
      { from: 0, to: 199 },
      { from: 200, to: 399 },
      { from: 400, to: 499 },
    ]);
  });

  it("2000 → ten chunks", () => {
    expect(buildSearchCandidateRanges(2000, 200)).toHaveLength(10);
    expect(buildSearchCandidateRanges(2000, 200)[9]).toEqual({ from: 1800, to: 1999 });
  });
});

describe("SEARCH_RELEVANCE_CHUNK_SIZE", () => {
  it("is 200 with no result cap constant", () => {
    expect(SEARCH_RELEVANCE_CHUNK_SIZE).toBe(200);
  });
});

describe("global relevance rank", () => {
  const intent = resolveSearchTaxonomyIntent("일본", taxonomyContext);

  it("201st title exact beats first 200 low-relevance rows", () => {
    const low: SearchRankCandidate[] = Array.from({ length: 200 }, (_, i) =>
      candidate({
        id: `low-${i}`,
        title: `일본 관련 상품 ${i}`,
        category: "기타",
        sort_order: i,
        created_at: "2024-01-01T00:00:00Z",
      }),
    );
    const exact = candidate({
      id: "exact-201",
      title: "일본",
      category: "일본",
      destination_id: "jp",
      sort_order: 9999,
      created_at: "2020-01-01T00:00:00Z",
    });
    const ranked = rankSearchCandidates([...low, exact], "일본", intent);
    expect(ranked[0]?.id).toBe("exact-201");
    expect(relevanceScore(exact, "일본", intent)).toBe(1);
  });

  it("exact totalCount semantics via slice: 150 candidates → page 5 exists", () => {
    const items: SearchRankCandidate[] = Array.from({ length: 150 }, (_, i) =>
      candidate({
        id: `p-${String(i).padStart(3, "0")}`,
        title: `상품 ${i}`,
        sort_order: i,
        created_at: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    const ranked = rankSearchCandidates(items, "상품", {});
    expect(ranked).toHaveLength(150);
    const pageSize = 24;
    const totalPages = Math.ceil(150 / pageSize);
    expect(totalPages).toBe(7);
    const page5 = sliceRankedCandidatePage(ranked, 5, pageSize);
    expect(page5).toHaveLength(24);
    expect(page5[0]?.id).toBe(ranked[96]?.id);
  });

  it("page 2 returns ranked indices 24..47", () => {
    const items: SearchRankCandidate[] = Array.from({ length: 100 }, (_, i) =>
      candidate({
        id: `id-${i}`,
        title: `t-${99 - i}`,
        sort_order: i,
        created_at: "2024-06-01T00:00:00Z",
      }),
    );
    const ranked = rankSearchCandidates(items, "t-", {});
    const page1 = sliceRankedCandidatePage(ranked, 1, 24);
    const page2 = sliceRankedCandidatePage(ranked, 2, 24);
    expect(page1.map((c) => c.id)).toEqual(ranked.slice(0, 24).map((c) => c.id));
    expect(page2.map((c) => c.id)).toEqual(ranked.slice(24, 48).map((c) => c.id));
  });

  it("537 total → totalPages 23 at pageSize 24", () => {
    const total = 537;
    const pageSize = 24;
    expect(Math.ceil(total / pageSize)).toBe(23);
  });

  it("tie-breaker: sort_order ASC then created_at DESC then id ASC", () => {
    const a = candidate({
      id: "b-id",
      title: "일본",
      sort_order: 1,
      created_at: "2024-01-02T00:00:00Z",
    });
    const b = candidate({
      id: "a-id",
      title: "일본",
      sort_order: 1,
      created_at: "2024-01-02T00:00:00Z",
    });
    expect(compareSearchRankCandidates(a, b, "일본", intent)).toBeGreaterThan(0);
    expect(rankSearchCandidates([a, b], "일본", intent)[0]?.id).toBe("a-id");
  });

  it("relevance ordering regression tiers", () => {
    const intentLocal = resolveSearchTaxonomyIntent("일본", taxonomyContext);
    const exact = candidate({ id: "1", title: "일본" });
    const prefix = candidate({ id: "2", title: "일본 패키지" });
    const selfTax = candidate({ id: "3", title: "x", destination_id: "jp", category: "일본" });
    const contains = candidate({ id: "4", title: "best 일본 tour" });
    const desc = candidate({ id: "5", title: "x", destination_id: "osaka", category: "오사카" });
    const cat = candidate({ id: "6", title: "x", category: "일본 특선" });
    const fallback = candidate({ id: "7", title: "other" });

    expect(relevanceScore(exact, "일본", intentLocal)).toBeLessThan(
      relevanceScore(prefix, "일본", intentLocal),
    );
    expect(relevanceScore(prefix, "일본", intentLocal)).toBeLessThan(
      relevanceScore(selfTax, "일본", intentLocal),
    );
    expect(relevanceScore(selfTax, "일본", intentLocal)).toBeLessThan(
      relevanceScore(contains, "일본", intentLocal),
    );
    expect(relevanceScore(contains, "일본", intentLocal)).toBeLessThan(
      relevanceScore(desc, "일본", intentLocal),
    );
    expect(relevanceScore(desc, "일본", intentLocal)).toBeLessThan(
      relevanceScore(cat, "일본", intentLocal),
    );
    expect(relevanceScore(cat, "일본", intentLocal)).toBeLessThan(
      relevanceScore(fallback, "일본", intentLocal),
    );
  });
});

describe("mapRowToSearchRankCandidate", () => {
  it("maps minimal DB row", () => {
    expect(
      mapRowToSearchRankCandidate({
        id: "abc",
        title: "T",
        category: "C",
        theme: "th",
        destination_id: "d1",
        product_line_id: "pl",
        sort_order: 3,
        created_at: "2024-01-01",
      }),
    ).toEqual({
      id: "abc",
      title: "T",
      category: "C",
      theme: "th",
      destination_id: "d1",
      product_line_id: "pl",
      sort_order: 3,
      created_at: "2024-01-01",
    });
  });
});
