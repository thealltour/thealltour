import { describe, expect, it } from "vitest";
import {
  destinationScopesEqual,
  resolveDestinationScope,
  resolveThemeScope,
} from "@/lib/search/resolveDestinationScope";
import { resolveSearchTaxonomyIntent } from "@/lib/search/resolveSearchTaxonomyIntent";
import {
  parseSearchIntent,
  normalizeSearchQuery,
  stripGenericTravelTerms,
  consumePhraseFlexible,
  GOLF_SEARCH_SYNONYMS,
} from "@/lib/search/parseSearchIntent";
import {
  GENERIC_TRAVEL_QUERY_TERMS,
  PACKAGE_TRAVEL_SEARCH_SYNONYMS,
} from "@/lib/search/searchQueryVocabulary";
import {
  buildDestinationScopeOrFilter,
  buildSearchKeywordCandidateOrFilter,
  buildStructuredSearchAxisFilters,
  mergeDestinationScopes,
} from "@/lib/search/searchCandidateFilters";
import { relevanceScore, SEARCH_RELEVANCE_CHUNK_SIZE } from "@/lib/search/searchProducts";
import { GOLF_PRESET_CATEGORIES } from "@/lib/products/golfChannel";
import { PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE } from "@/lib/productFilters";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

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

const destinations: ProductTaxonomy[] = [
  tax({ id: "sea", name: "동남아", taxonomy_type: "destination" }),
  tax({ id: "ph", name: "필리핀", taxonomy_type: "destination", parent_id: "sea" }),
  tax({ id: "vn", name: "베트남", taxonomy_type: "destination", parent_id: "sea" }),
  tax({ id: "th", name: "태국", taxonomy_type: "destination", parent_id: "sea" }),
  tax({ id: "danang", name: "다낭", taxonomy_type: "destination", parent_id: "vn" }),
  tax({ id: "jp", name: "일본", taxonomy_type: "destination" }),
  tax({ id: "osaka", name: "오사카", taxonomy_type: "destination", parent_id: "jp" }),
  tax({ id: "tokyo", name: "도쿄", taxonomy_type: "destination", parent_id: "jp" }),
  tax({ id: "es", name: "스페인", taxonomy_type: "destination" }),
  tax({ id: "eu", name: "유럽", taxonomy_type: "destination" }),
];

const themes: ProductTaxonomy[] = [
  tax({ id: "family", name: "가족여행", taxonomy_type: "theme" }),
  tax({ id: "kids", name: "아이동반", taxonomy_type: "theme", parent_id: "family" }),
];

const productLines = [
  tax({ id: "pl-pkg", name: "패키지관광", taxonomy_type: "product_line" }),
  tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf-tour" }),
  tax({ id: "pl-park", name: "파크골프투어", taxonomy_type: "product_line", slug: "park-golf" }),
];

const taxonomyContext = { destinations, themes, productLines };

function product(partial: Partial<Product> & Pick<Product, "id" | "title">): Product {
  return {
    slug: partial.id,
    description: "",
    price: 0,
    category: "",
    ...partial,
  } as Product;
}

describe("resolveDestinationScope / Browse-Search parity", () => {
  it("일본 / 스페인 scopes", () => {
    expect(resolveDestinationScope("일본", destinations).ids).toEqual(["jp", "osaka", "tokyo"]);
    expect(resolveDestinationScope("스페인", destinations).ids).toEqual(["es"]);
    expect(
      destinationScopesEqual(
        resolveDestinationScope("일본", destinations),
        resolveDestinationScope("일본", destinations),
      ),
    ).toBe(true);
  });

  it("동남아 includes 필리핀", () => {
    expect(resolveDestinationScope("동남아", destinations).ids).toContain("ph");
  });
});

describe("vocabulary", () => {
  it("generic terms are minimal domain nouns only", () => {
    expect([...GENERIC_TRAVEL_QUERY_TERMS]).toEqual(["여행상품", "여행", "상품"]);
    expect(PACKAGE_TRAVEL_SEARCH_SYNONYMS).toContain(PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE);
    expect(PACKAGE_TRAVEL_SEARCH_SYNONYMS).toContain("패키지");
    expect(GOLF_SEARCH_SYNONYMS).toContain("골프");
  });

  it("stripGenericTravelTerms is boundary-safe", () => {
    expect(stripGenericTravelTerms("여행")).toBe("");
    expect(stripGenericTravelTerms("온천 여행")).toBe("온천");
    expect(stripGenericTravelTerms("여행 상품")).toBe("");
    expect(stripGenericTravelTerms("여행상품")).toBe("");
  });

  it("spacing-flexible consume: 가족여행 ↔ 가족 여행", () => {
    expect(consumePhraseFlexible("베트남 가족 여행", "가족여행")).toBe("베트남");
    expect(consumePhraseFlexible("파크 골프 일본", "파크골프")).toBe("일본");
  });
});

describe("resolveSearchTaxonomyIntent (single exact)", () => {
  it("q=일본 / 골프 / 가족여행", () => {
    expect(resolveSearchTaxonomyIntent("일본", taxonomyContext).destination?.ids).toContain("osaka");
    expect(resolveSearchTaxonomyIntent("골프", taxonomyContext).golf?.productLineIds).toContain(
      "pl-golf",
    );
    expect(resolveSearchTaxonomyIntent("가족여행", taxonomyContext).theme?.names).toContain(
      "아이동반",
    );
  });
});

describe("generic travel wording hardening", () => {
  it("스페인 / 스페인 여행 / 여행 스페인 → same Spain destination, no remaining", () => {
    for (const q of ["스페인", "스페인 여행", "여행 스페인", "스페인 여행상품", "스페인 상품"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.matchedName).toBe("스페인");
      expect(parsed.remainingText).toBe("");
      expect(parsed.destinations[0]?.ids).toEqual(["es"]);
    }
  });

  it("스페인 패키지 / 스페인 패키지 여행 → Spain AND unassigned package", () => {
    for (const q of ["스페인 패키지", "스페인 패키지 여행"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.matchedName).toBe("스페인");
      expect(parsed.unassignedProductLine).toBe(true);
      expect(parsed.remainingText).toBe("");
      expect(parsed.mode).toBe("structured");
    }
  });

  it("일본 골프 여행 / 여행 일본 골프 → Japan AND Golf", () => {
    for (const q of ["일본 골프", "일본 골프 여행", "여행 일본 골프"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.matchedName).toBe("일본");
      expect(parsed.golf).toBeTruthy();
      expect(parsed.remainingText).toBe("");
    }
  });

  it("동남아 골프 여행 / 골프 동남아 여행 → SEA AND Golf", () => {
    for (const q of ["동남아 골프", "동남아 골프 여행", "골프 동남아 여행"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.matchedName).toBe("동남아");
      expect(parsed.golf).toBeTruthy();
      expect(parsed.remainingText).toBe("");
      expect(parsed.destinations[0]?.ids).toContain("ph");
    }
  });

  it("베트남 가족여행 / 베트남 가족 여행 / 가족여행 베트남", () => {
    for (const q of ["베트남 가족여행", "베트남 가족 여행", "가족여행 베트남"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.matchedName).toBe("베트남");
      expect(parsed.themes[0]?.matchedName).toBe("가족여행");
      expect(parsed.remainingText).toBe("");
    }
  });

  it("오사카 온천 / 오사카 온천 여행 / 여행 오사카 온천 → Osaka AND 온천", () => {
    for (const q of ["오사카 온천", "오사카 온천 여행", "여행 오사카 온천"]) {
      const parsed = parseSearchIntent(q, taxonomyContext);
      expect(parsed.destinations[0]?.ids).toEqual(["osaka"]);
      expect(parsed.remainingText).toBe("온천");
    }
  });

  it("온천 여행 → text 온천 (generic stripped without emptying)", () => {
    const parsed = parseSearchIntent("온천 여행", taxonomyContext);
    expect(parsed.mode).toBe("text-only");
    expect(parsed.remainingText).toBe("온천");
  });

  it("여행 only → text fallback (not empty structured)", () => {
    const parsed = parseSearchIntent("여행", taxonomyContext);
    expect(parsed.mode).toBe("text-only");
    expect(parsed.remainingText).toBe("여행");
  });

  it("상품 / 여행상품 alone → text fallback", () => {
    expect(parseSearchIntent("상품", taxonomyContext).remainingText).toBe("상품");
    expect(parseSearchIntent("여행상품", taxonomyContext).remainingText).toBe("여행상품");
  });

  it("일본 특가 keeps meaningful remaining", () => {
    const parsed = parseSearchIntent("일본 특가", taxonomyContext);
    expect(parsed.destinations[0]?.matchedName).toBe("일본");
    expect(parsed.remainingText).toBe("특가");
  });
});

describe("multi-intent regression", () => {
  it("동남아 골프 order independence", () => {
    const a = parseSearchIntent("동남아 골프", taxonomyContext);
    const b = parseSearchIntent("골프 동남아", taxonomyContext);
    expect(a.destinations[0]?.ids).toEqual(b.destinations[0]?.ids);
    expect(a.golf?.productLineIds).toEqual(b.golf?.productLineIds);
  });

  it("일본 파크골프 / 파크 골프 일본", () => {
    const a = parseSearchIntent("일본 파크골프", taxonomyContext);
    const b = parseSearchIntent("파크 골프 일본", taxonomyContext);
    expect(a.golf).toBeTruthy();
    expect(b.golf).toBeTruthy();
    expect(a.destinations[0]?.matchedName).toBe("일본");
    expect(b.destinations[0]?.matchedName).toBe("일본");
  });

  it("structured AND groups remain separate", () => {
    const parsed = parseSearchIntent("동남아 골프", taxonomyContext);
    const axes = buildStructuredSearchAxisFilters(parsed);
    expect(axes.destinationOr).toContain("ph");
    expect(axes.golfOr).toContain("product_line_id.in.");
    expect(axes.remainingTextOr).toBeNull();
  });

  it("일본 베트남 골프 → destination OR union AND golf", () => {
    const parsed = parseSearchIntent("일본 베트남 골프", taxonomyContext);
    const merged = mergeDestinationScopes(parsed.destinations);
    expect(merged?.ids).toContain("osaka");
    expect(merged?.ids).toContain("vn");
    expect(parsed.golf).toBeTruthy();
  });
});

describe("Search/Browse scope parity (pure)", () => {
  it("q=일본 destination ids === region=일본", () => {
    const browse = resolveDestinationScope("일본", destinations);
    const search = parseSearchIntent("일본", taxonomyContext).destinations[0]!;
    expect(destinationScopesEqual(browse, search)).toBe(true);
  });

  it("q=동남아 골프 destination === region=동남아; golf channel non-empty", () => {
    const browse = resolveDestinationScope("동남아", destinations);
    const parsed = parseSearchIntent("동남아 골프", taxonomyContext);
    expect(destinationScopesEqual(browse, parsed.destinations[0]!)).toBe(true);
    expect(parsed.golf?.legacyCategories).toEqual([...GOLF_PRESET_CATEGORIES]);
  });

  it("q=베트남 가족여행 theme names === resolveThemeScope", () => {
    const theme = resolveThemeScope("가족여행", themes);
    const parsed = parseSearchIntent("베트남 가족여행", taxonomyContext);
    expect(parsed.themes[0]?.names).toEqual(theme.names);
  });
});

describe("buildSearchKeywordCandidateOrFilter single-mode", () => {
  it("unions text + destination for 일본", () => {
    const intent = resolveSearchTaxonomyIntent("일본", taxonomyContext);
    const or = buildSearchKeywordCandidateOrFilter("일본", intent);
    expect(or).toContain("title.ilike.%일본%");
    expect(or).toContain("destination_id.in.");
  });
});

describe("relevanceScore", () => {
  it("title exact beats taxonomy descendant", () => {
    const intent = resolveSearchTaxonomyIntent("일본", taxonomyContext);
    const titleExact = product({ id: "a", title: "일본" });
    const descendant = product({ id: "e", title: "오사카 자유여행", destination_id: "osaka" });
    expect(relevanceScore(titleExact, "일본", intent)).toBeLessThan(
      relevanceScore(descendant, "일본", intent),
    );
  });
});

describe("relevance scale contract (01C)", () => {
  it("chunk size 200, no result cap export", () => {
    expect(SEARCH_RELEVANCE_CHUNK_SIZE).toBe(200);
  });
});

describe("Search quality matrix", () => {
  const rows: Array<{
    q: string;
    check: (p: ReturnType<typeof parseSearchIntent>) => void;
  }> = [
    { q: "스페인", check: (p) => expect(p.destinations[0]?.matchedName).toBe("스페인") },
    {
      q: "스페인 여행",
      check: (p) => {
        expect(p.destinations[0]?.matchedName).toBe("스페인");
        expect(p.remainingText).toBe("");
      },
    },
    {
      q: "스페인 패키지",
      check: (p) => {
        expect(p.destinations[0]?.matchedName).toBe("스페인");
        expect(p.unassignedProductLine).toBe(true);
      },
    },
    {
      q: "일본 골프 여행",
      check: (p) => {
        expect(p.destinations[0]?.matchedName).toBe("일본");
        expect(p.golf).toBeTruthy();
        expect(p.remainingText).toBe("");
      },
    },
    {
      q: "동남아 골프 여행",
      check: (p) => {
        expect(p.destinations[0]?.matchedName).toBe("동남아");
        expect(p.golf).toBeTruthy();
      },
    },
    {
      q: "베트남 가족 여행",
      check: (p) => {
        expect(p.destinations[0]?.matchedName).toBe("베트남");
        expect(p.themes[0]?.matchedName).toBe("가족여행");
      },
    },
    {
      q: "오사카 온천 여행",
      check: (p) => {
        expect(p.destinations[0]?.ids).toEqual(["osaka"]);
        expect(p.remainingText).toBe("온천");
      },
    },
    { q: "골프", check: (p) => expect(p.golf).toBeTruthy() },
    { q: "일본", check: (p) => expect(p.destinations[0]?.matchedName).toBe("일본") },
    { q: "여행", check: (p) => expect(p.remainingText).toBe("여행") },
    { q: "온천 여행", check: (p) => expect(p.remainingText).toBe("온천") },
  ];

  for (const row of rows) {
    it(`PASS ${row.q}`, () => {
      row.check(parseSearchIntent(row.q, taxonomyContext));
    });
  }
});

describe("normalize", () => {
  it("collapses spaces", () => {
    expect(normalizeSearchQuery("  스페인   여행  ")).toBe("스페인 여행");
  });
});
