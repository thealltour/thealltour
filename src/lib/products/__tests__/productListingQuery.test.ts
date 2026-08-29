import { describe, expect, it } from "vitest";
import {
  PRODUCT_LIST_PAGE_SIZE,
  PRODUCT_LIST_PAGE_SIZE_MAX,
  applyProductListingDbFilters,
  applyProductListingSort,
  buildCollectionOrFilter,
  buildDestinationScopeOrFilter,
  buildGolfOrFilter,
  buildProductPageMeta,
  buildProductPageRange,
  buildThemeOrFilter,
  buildThemeTokenMatchClause,
  normalizeProductListingDbFilters,
  normalizeProductPageInput,
  quotePostgrestValue,
  resolveProductListingSort,
  type ListingFilterQuery,
} from "@/lib/products/productListingQuery";
import {
  buildProductListingQueryParams,
  resolveListingSortFromUrl,
} from "@/lib/products/buildProductListingQueryParams";
import { PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE } from "@/lib/productFilters";
import { GOLF_PRESET_CATEGORIES, GOLF_TOUR_TYPE } from "@/lib/products/golfChannel";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

describe("normalizeProductPageInput", () => {
  it("defaults page=1 and pageSize=24", () => {
    expect(normalizeProductPageInput({})).toEqual({
      page: 1,
      pageSize: PRODUCT_LIST_PAGE_SIZE,
    });
  });

  it("normalizes invalid page to 1", () => {
    expect(normalizeProductPageInput({ page: undefined }).page).toBe(1);
    expect(normalizeProductPageInput({ page: 0 }).page).toBe(1);
    expect(normalizeProductPageInput({ page: -5 }).page).toBe(1);
    expect(normalizeProductPageInput({ page: Number.NaN }).page).toBe(1);
    expect(normalizeProductPageInput({ page: Number.POSITIVE_INFINITY }).page).toBe(1);
  });

  it("floors valid page", () => {
    expect(normalizeProductPageInput({ page: 2.9 }).page).toBe(2);
  });

  it("pageSize undefined → 24; 0/negative → default; too large → max", () => {
    expect(normalizeProductPageInput({ pageSize: undefined }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: 0 }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: -1 }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: 101 }).pageSize).toBe(PRODUCT_LIST_PAGE_SIZE_MAX);
    expect(normalizeProductPageInput({ pageSize: 50 }).pageSize).toBe(50);
  });
});

describe("buildProductPageRange", () => {
  it("page 1 / size 24 → 0..23", () => {
    expect(buildProductPageRange(1, 24)).toEqual({ from: 0, to: 23 });
  });
  it("page 2 → 24..47", () => {
    expect(buildProductPageRange(2, 24)).toEqual({ from: 24, to: 47 });
  });
  it("page 3 → 48..71", () => {
    expect(buildProductPageRange(3, 24)).toEqual({ from: 48, to: 71 });
  });
});

describe("buildProductPageMeta", () => {
  it("0 results → totalPages=0, hasNext=false", () => {
    expect(buildProductPageMeta({ totalCount: 0, page: 1, pageSize: 24 })).toEqual({
      totalCount: 0,
      page: 1,
      pageSize: 24,
      totalPages: 0,
      hasNextPage: false,
    });
  });

  it("totalCount boundaries", () => {
    expect(buildProductPageMeta({ totalCount: 1, page: 1, pageSize: 24 }).totalPages).toBe(1);
    expect(buildProductPageMeta({ totalCount: 24, page: 1, pageSize: 24 }).totalPages).toBe(1);
    expect(buildProductPageMeta({ totalCount: 25, page: 1, pageSize: 24 })).toMatchObject({
      totalPages: 2,
      hasNextPage: true,
    });
    expect(buildProductPageMeta({ totalCount: 25, page: 2, pageSize: 24 })).toMatchObject({
      totalPages: 2,
      hasNextPage: false,
    });
  });

  it("out-of-range page keeps page number; hasNext=false", () => {
    expect(buildProductPageMeta({ totalCount: 30, page: 99, pageSize: 24 })).toEqual({
      totalCount: 30,
      page: 99,
      pageSize: 24,
      totalPages: 2,
      hasNextPage: false,
    });
  });
});

describe("resolveProductListingSort", () => {
  it("maps known sorts; unknown → recommended", () => {
    expect(resolveProductListingSort("latest")).toBe("latest");
    expect(resolveProductListingSort("price_asc")).toBe("price_asc");
    expect(resolveProductListingSort("price_desc")).toBe("price_desc");
    expect(resolveProductListingSort("recommended")).toBe("recommended");
    expect(resolveProductListingSort(null)).toBe("recommended");
    expect(resolveProductListingSort(undefined)).toBe("recommended");
  });

  it("aliases popular→recommended and new→latest", () => {
    expect(resolveProductListingSort("popular")).toBe("recommended");
    expect(resolveProductListingSort("new")).toBe("latest");
  });
});

describe("applyProductListingSort", () => {
  it("always ends with id ASC tie-breaker", () => {
    const calls: { column: string; ascending?: boolean }[] = [];
    const stub = {
      order(column: string, options?: { ascending?: boolean }) {
        calls.push({ column, ascending: options?.ascending });
        return stub;
      },
    };

    for (const sort of ["recommended", "latest", "price_asc", "price_desc"] as const) {
      calls.length = 0;
      applyProductListingSort(stub, sort);
      expect(calls.at(-1)).toEqual({ column: "id", ascending: true });
    }
  });

  it("recommended uses sort_order then created_at then id", () => {
    const cols: string[] = [];
    const stub = {
      order(column: string) {
        cols.push(column);
        return stub;
      },
    };
    applyProductListingSort(stub, "recommended");
    expect(cols).toEqual(["sort_order", "created_at", "id"]);
  });
});

describe("normalizeProductListingDbFilters — destination scope", () => {
  it("single destinationId → destinationScope.ids", () => {
    expect(normalizeProductListingDbFilters({ destinationId: " d1 " })).toMatchObject({
      matchNone: false,
      destinationScope: { ids: ["d1"], names: [] },
    });
  });

  it("multiple destinationIds kept unique", () => {
    expect(
      normalizeProductListingDbFilters({
        destinationIds: ["a", "b", "a", ""],
      }).destinationScope,
    ).toEqual({ ids: ["a", "b"], names: [] });
  });

  it("empty destinationIds → matchNone (no catalog fallback)", () => {
    expect(normalizeProductListingDbFilters({ destinationIds: [] })).toMatchObject({
      matchNone: true,
      destinationScope: undefined,
    });
  });

  it("merges destinationId into destinationScope.ids", () => {
    expect(
      normalizeProductListingDbFilters({
        destinationIds: ["a"],
        destinationId: "b",
      }).destinationScope,
    ).toEqual({ ids: ["a", "b"], names: [] });
  });

  it("destinationScope merges ids + names; empty both → matchNone", () => {
    expect(
      normalizeProductListingDbFilters({
        destinationScope: { ids: ["osaka"], names: ["오사카"] },
        destinationIds: ["tokyo"],
      }).destinationScope,
    ).toEqual({ ids: ["osaka", "tokyo"], names: ["오사카"] });

    expect(
      normalizeProductListingDbFilters({
        destinationScope: { ids: [], names: [] },
      }),
    ).toMatchObject({ matchNone: true, destinationScope: undefined });
  });

  it("names only kept (no matchNone)", () => {
    expect(
      normalizeProductListingDbFilters({
        destinationScope: { ids: [], names: ["오사카"] },
      }),
    ).toMatchObject({
      matchNone: false,
      destinationScope: { ids: [], names: ["오사카"] },
    });
  });
});

describe("buildDestinationScopeOrFilter", () => {
  it("ids only → destination_id.in", () => {
    const or = buildDestinationScopeOrFilter({ ids: ["a", "b"], names: [] });
    expect(or).toBe(
      `destination_id.in.(${quotePostgrestValue("a")},${quotePostgrestValue("b")})`,
    );
    expect(or).not.toContain("category");
  });

  it("names only → category.in (exact, no ilike)", () => {
    const or = buildDestinationScopeOrFilter({ ids: [], names: ["오사카"] });
    expect(or).toBe(`category.in.(${quotePostgrestValue("오사카")})`);
    expect(or?.toLowerCase()).not.toContain("ilike");
  });

  it("ids + names → OR of destination_id and category", () => {
    const or = buildDestinationScopeOrFilter({
      ids: ["osaka"],
      names: ["오사카"],
    });
    expect(or).toContain("destination_id.in.");
    expect(or).toContain("category.in.");
    expect(or?.includes(",") && or.indexOf("destination_id") < or.indexOf("category")).toBe(
      true,
    );
  });

  it("empty → null", () => {
    expect(buildDestinationScopeOrFilter({ ids: [], names: [] })).toBeNull();
  });
});

describe("normalizeProductListingDbFilters — product line", () => {
  it("keeps productLineId", () => {
    expect(
      normalizeProductListingDbFilters({ productLineId: " pl-1 " }).productLineId,
    ).toBe("pl-1");
  });

  it("unassigned clears conflicting productLineId", () => {
    expect(
      normalizeProductListingDbFilters({
        productLineId: "pl-1",
        unassignedProductLine: true,
      }),
    ).toMatchObject({
      unassignedProductLine: true,
      productLineId: undefined,
    });
  });
});

describe("theme OR filter builders", () => {
  it("builds token-boundary match clause (parseThemeTokens delimiters)", () => {
    const clause = buildThemeTokenMatchClause("골프");
    expect(clause).toBe(`theme.match.${quotePostgrestValue("(^|[,\\n|])골프($|[,\\n|])")}`);
  });

  it("ORs multiple theme names; empty → null", () => {
    expect(buildThemeOrFilter([])).toBeNull();
    const or = buildThemeOrFilter(["골프", "온천"]);
    expect(or).toContain("골프");
    expect(or).toContain("온천");
    expect(or?.match(/theme\.match\./g)?.length).toBe(2);
  });

  it("escapes regex metacharacters in theme name", () => {
    const clause = buildThemeTokenMatchClause("a+b");
    // quotePostgrestValue doubles backslashes from escapeRegexLiteral
    expect(clause).toContain("a\\\\+b");
  });
});

describe("collection OR filter", () => {
  it("recommend = is_recommend OR campaign contains", () => {
    const or = buildCollectionOrFilter({
      kind: "recommend",
      campaignNames: ["봄특가"],
    });
    expect(or).toContain("is_recommend.eq.true");
    expect(or).toContain(`campaigns_json.cs.{${quotePostgrestValue("봄특가")}}`);
  });

  it("popular = is_popular OR campaign contains", () => {
    const or = buildCollectionOrFilter({ kind: "popular", campaignNames: [] });
    expect(or).toBe("is_popular.eq.true");
  });
});

describe("golf OR filter", () => {
  it("product_line_id IN OR category IN (never AND-only)", () => {
    const or = buildGolfOrFilter({
      productLineIds: ["g1", "g2"],
      legacyCategories: [...GOLF_PRESET_CATEGORIES],
    });
    expect(or).toContain("product_line_id.in.");
    expect(or).toContain("category.in.");
    expect(or).toContain("골프투어");
    expect(or?.includes(",") && or.indexOf("product_line_id") < or.indexOf("category")).toBe(
      true,
    );
  });

  it("empty golf channel → null; normalize marks matchNone", () => {
    expect(buildGolfOrFilter({ productLineIds: [], legacyCategories: [] })).toBeNull();
    expect(
      normalizeProductListingDbFilters({
        golfChannel: { productLineIds: [], legacyCategories: [] },
      }).matchNone,
    ).toBe(true);
  });
});

describe("applyProductListingDbFilters AND/OR grouping", () => {
  function createStub() {
    const calls: { op: string; args: unknown[] }[] = [];
    const stub: ListingFilterQuery = {
      eq(column, value) {
        calls.push({ op: "eq", args: [column, value] });
        return stub;
      },
      in(column, values) {
        calls.push({ op: "in", args: [column, values] });
        return stub;
      },
      is(column, value) {
        calls.push({ op: "is", args: [column, value] });
        return stub;
      },
      or(filters) {
        calls.push({ op: "or", args: [filters] });
        return stub;
      },
    };
    return { stub, calls };
  }

  it("applies destination OR + theme OR + collection OR + golf OR + unassigned (AND across axes)", () => {
    const { stub, calls } = createStub();
    applyProductListingDbFilters(
      stub,
      normalizeProductListingDbFilters({
        destinationScope: {
          ids: ["d1", "d2"],
          names: ["오사카"],
        },
        unassignedProductLine: true,
        themeNames: ["골프"],
        collection: { kind: "recommend", campaignNames: ["캠A"] },
        golfChannel: {
          productLineIds: ["g1"],
          legacyCategories: ["골프투어"],
        },
      }),
    );

    expect(calls.filter((c) => c.op === "in")).toEqual([]);
    expect(calls.filter((c) => c.op === "is")).toEqual([
      { op: "is", args: ["product_line_id", null] },
    ]);
    const ors = calls.filter((c) => c.op === "or").map((c) => String(c.args[0]));
    expect(ors).toHaveLength(4);
    // region OR group first — not flattened into theme/golf
    expect(ors[0]).toContain("destination_id.in.");
    expect(ors[0]).toContain("category.in.");
    expect(ors[0]).toContain("오사카");
    expect(ors[1]).toContain("theme.match.");
    expect(ors[2]).toContain("is_recommend.eq.true");
    expect(ors[3]).toContain("product_line_id.in.");
    expect(ors[3]).toContain("category.in.");
  });

  it("region + theme: destination OR and theme OR stay separate", () => {
    const { stub, calls } = createStub();
    applyProductListingDbFilters(
      stub,
      normalizeProductListingDbFilters({
        destinationScope: { ids: ["jp"], names: ["일본"] },
        themeNames: ["온천"],
      }),
    );
    const ors = calls.filter((c) => c.op === "or").map((c) => String(c.args[0]));
    expect(ors).toHaveLength(2);
    expect(ors[0]).toContain("destination_id");
    expect(ors[0]).not.toContain("theme.match");
    expect(ors[1]).toContain("theme.match");
    expect(ors[1]).not.toContain("destination_id");
  });

  it("region + collection: separate OR groups", () => {
    const { stub, calls } = createStub();
    applyProductListingDbFilters(
      stub,
      normalizeProductListingDbFilters({
        destinationScope: { ids: ["jp"], names: [] },
        collection: { kind: "popular", campaignNames: [] },
      }),
    );
    const ors = calls.filter((c) => c.op === "or").map((c) => String(c.args[0]));
    expect(ors).toHaveLength(2);
    expect(ors[0]).toContain("destination_id.in.");
    expect(ors[1]).toBe("is_popular.eq.true");
  });

  it("region + Golf: destination OR and golf OR not flattened", () => {
    const { stub, calls } = createStub();
    applyProductListingDbFilters(
      stub,
      normalizeProductListingDbFilters({
        destinationScope: { ids: ["vn"], names: ["베트남"] },
        golfChannel: {
          productLineIds: ["g1"],
          legacyCategories: ["골프투어"],
        },
      }),
    );
    const ors = calls.filter((c) => c.op === "or").map((c) => String(c.args[0]));
    expect(ors).toHaveLength(2);
    expect(ors[0]).toContain("destination_id.in.");
    expect(ors[0]).toContain("베트남");
    expect(ors[1]).toContain("product_line_id.in.");
    expect(ors[1]).toContain("골프투어");
    expect(ors[0]).not.toContain("product_line_id");
    expect(ors[1]).not.toContain("destination_id");
  });
});

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

describe("buildProductListingQueryParams adapter", () => {
  const destinations: ProductTaxonomy[] = [
    tax({ id: "asia", name: "해외", taxonomy_type: "destination", parent_id: null }),
    tax({ id: "jp", name: "일본", taxonomy_type: "destination", parent_id: "asia" }),
    tax({ id: "tokyo", name: "도쿄", taxonomy_type: "destination", parent_id: "jp" }),
  ];
  const themes: ProductTaxonomy[] = [
    tax({ id: "golf", name: "골프", taxonomy_type: "theme", parent_id: null }),
    tax({ id: "park", name: "파크골프", taxonomy_type: "theme", parent_id: "golf" }),
  ];
  const productLines = [
    tax({ id: "pl-pkg", name: "패키지관광", taxonomy_type: "product_line" }),
    tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf-tour" }),
  ];

  it("region → destinationScope ids + names (self + descendants)", () => {
    const params = buildProductListingQueryParams({
      filters: { region: "일본" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(params.filters?.destinationScope).toEqual({
      ids: ["jp", "tokyo"],
      names: ["일본", "도쿄"],
    });
    expect(params.filters?.destinationIds).toBeUndefined();
    expect(params.filters?.matchNone).toBeUndefined();
  });

  it("unknown region → names-only scope (legacy category exact), not matchNone", () => {
    const params = buildProductListingQueryParams({
      filters: { region: "존재하지않음" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(params.filters?.matchNone).toBeUndefined();
    expect(params.filters?.destinationScope).toEqual({
      ids: [],
      names: ["존재하지않음"],
    });
  });

  it("empty resolved scope → matchNone", () => {
    const params = buildProductListingQueryParams({
      filters: { region: "   " },
      taxonomy: { destinations, themes, productLines },
    });
    // trimmed empty region is ignored (no destination filter)
    expect(params.filters?.destinationScope).toBeUndefined();
    expect(params.filters?.matchNone).toBeUndefined();
  });

  it("theme → self + descendant themeNames", () => {
    const params = buildProductListingQueryParams({
      filters: { theme: "골프" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(params.filters?.themeNames).toEqual(["골프", "파크골프"]);
  });

  it("product_line name → productLineId; 패키지여행 → unassigned", () => {
    expect(
      buildProductListingQueryParams({
        filters: { product_line: "패키지관광" },
        taxonomy: { destinations, themes, productLines },
      }).filters,
    ).toMatchObject({ productLineId: "pl-pkg" });

    expect(
      buildProductListingQueryParams({
        filters: { productLine: PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE },
        taxonomy: { destinations, themes, productLines },
      }).filters,
    ).toMatchObject({ unassignedProductLine: true });
  });

  it("unknown product_line → matchNone", () => {
    expect(
      buildProductListingQueryParams({
        filters: { product_line: "없는상품군" },
        taxonomy: { destinations, themes, productLines },
      }).filters?.matchNone,
    ).toBe(true);
  });

  it("collection recommend/popular + new→latest", () => {
    const rec = buildProductListingQueryParams({
      filters: { collection: "recommend" },
      taxonomy: {
        destinations,
        themes,
        productLines,
        campaignNamesByCollection: { recommend: ["봄특가"], popular: ["인기전"] },
      },
    });
    expect(rec.filters?.collection).toEqual({
      kind: "recommend",
      campaignNames: ["봄특가"],
    });

    const neu = buildProductListingQueryParams({
      filters: { collection: "new" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(neu.filters?.collection).toBeUndefined();
    expect(neu.sort).toBe("latest");

    expect(resolveListingSortFromUrl({ collection: "new", sort: "price_asc" })).toBe(
      "price_asc",
    );
  });

  it("unknown collection ignored", () => {
    const params = buildProductListingQueryParams({
      filters: { collection: "featured" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(params.filters?.collection).toBeUndefined();
  });

  it("tourType=golf-park → golf line ids + legacy categories", () => {
    const params = buildProductListingQueryParams({
      filters: { tourType: GOLF_TOUR_TYPE },
      taxonomy: { destinations, themes, productLines },
    });
    expect(params.filters?.golfChannel?.productLineIds).toEqual(["pl-golf"]);
    expect(params.filters?.golfChannel?.legacyCategories).toEqual([...GOLF_PRESET_CATEGORIES]);
  });

  it("golfRegion → destinationScope ids + names", () => {
    const params = buildProductListingQueryParams({
      filters: { tourType: GOLF_TOUR_TYPE, golfRegion: "japan-china" },
      taxonomy: {
        destinations: [
          tax({ id: "jp-root", name: "일본", taxonomy_type: "destination" }),
          tax({
            id: "osaka",
            name: "오사카",
            taxonomy_type: "destination",
            parent_id: "jp-root",
          }),
        ],
        themes,
        productLines,
      },
    });
    expect(params.filters?.destinationScope?.ids).toEqual(["jp-root", "osaka"]);
    expect(params.filters?.destinationScope?.names).toEqual([
      "일본",
      "오사카",
      "중국",
      "중국 / 대만",
      "대만",
      "홍콩",
      "마카오",
    ]);
    expect(params.filters?.golfChannel).toBeDefined();
  });

  it("combined region+theme+collection+golf+price sort", () => {
    const params = buildProductListingQueryParams({
      filters: {
        region: "일본",
        theme: "골프",
        collection: "popular",
        tourType: GOLF_TOUR_TYPE,
        sort: "price_asc",
      },
      taxonomy: {
        destinations,
        themes,
        productLines,
        campaignNamesByCollection: { popular: ["히트"] },
      },
    });
    expect(params.sort).toBe("price_asc");
    expect(params.filters?.destinationScope).toEqual({
      ids: ["jp", "tokyo"],
      names: ["일본", "도쿄"],
    });
    expect(params.filters?.themeNames).toEqual(["골프", "파크골프"]);
    expect(params.filters?.collection).toEqual({
      kind: "popular",
      campaignNames: ["히트"],
    });
    expect(params.filters?.golfChannel?.productLineIds).toContain("pl-golf");
  });
});
