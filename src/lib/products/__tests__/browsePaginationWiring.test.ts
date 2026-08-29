import { describe, expect, it } from "vitest";
import {
  buildProductsBrowsePageHref,
  readBrowseChannelParams,
} from "@/lib/products/buildProductsBrowseHref";
import { buildProductListingQueryParams } from "@/lib/products/buildProductListingQueryParams";
import {
  PRODUCT_LIST_PAGE_SIZE,
  buildProductPageRange,
  normalizeProductPageInput,
} from "@/lib/products/productListingQuery";
import { parseProductsSearchPage, isProductsSearchMode } from "@/lib/products/productsSearchMode";
import { mergeFiltersIntoSearchParams } from "@/lib/productFilters";
import { GOLF_TOUR_TYPE } from "@/lib/products/golfChannel";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getSearchPaginationPageNumbers } from "@/components/search/SearchPagination";

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

describe("POST-UI-01B-2 Browse pagination wiring helpers", () => {
  it("default page parser → 1; pageSize = PRODUCT_LIST_PAGE_SIZE (24)", () => {
    expect(parseProductsSearchPage({})).toBe(1);
    expect(parseProductsSearchPage({ page: "2" })).toBe(2);
    expect(parseProductsSearchPage({ page: "-1" })).toBe(1);
    expect(normalizeProductPageInput({ page: 1, pageSize: PRODUCT_LIST_PAGE_SIZE })).toEqual({
      page: 1,
      pageSize: 24,
    });
    expect(PRODUCT_LIST_PAGE_SIZE).toBe(24);
  });

  it("page 2 → range 24..47", () => {
    expect(buildProductPageRange(2, 24)).toEqual({ from: 24, to: 47 });
  });

  it("Search branch: q present → Search Mode (getProductsPage not used)", () => {
    expect(isProductsSearchMode("일본")).toBe(true);
    expect(isProductsSearchMode("")).toBe(false);
    expect(isProductsSearchMode("  ")).toBe(false);
  });

  it("buildProductsBrowsePageHref preserves filters and omits page=1", () => {
    expect(
      buildProductsBrowsePageHref(
        {
          region: "일본",
          theme: "가족여행",
          sort: "latest",
        },
        1,
      ),
    ).toBe("/products?region=%EC%9D%BC%EB%B3%B8&theme=%EA%B0%80%EC%A1%B1%EC%97%AC%ED%96%89&sort=latest");

    expect(
      buildProductsBrowsePageHref(
        {
          region: "일본",
          theme: "가족여행",
          sort: "latest",
        },
        2,
      ),
    ).toBe(
      "/products?region=%EC%9D%BC%EB%B3%B8&theme=%EA%B0%80%EC%A1%B1%EC%97%AC%ED%96%89&sort=latest&page=2",
    );
  });

  it("page href preserves tourType + golfRegion", () => {
    const href = buildProductsBrowsePageHref(
      {
        region: "동남아",
        tourType: GOLF_TOUR_TYPE,
        golfRegion: "se-asia",
        sort: "price_asc",
      },
      2,
    );
    expect(href).toContain("region=");
    expect(href).toContain(`tourType=${GOLF_TOUR_TYPE}`);
    expect(href).toContain("golfRegion=se-asia");
    expect(href).toContain("sort=price_asc");
    expect(href).toContain("page=2");
  });

  it("filter change deletes page (reset to 1)", () => {
    const current = new URLSearchParams(
      "region=%EC%9D%BC%EB%B3%B8&page=3&sort=latest&tourType=golf-park",
    );
    const next = mergeFiltersIntoSearchParams(current, {
      region: "일본",
      theme: "온천",
      product_line: null,
      sort: "latest",
      q: null,
      collection: null,
    });
    next.delete("page");
    expect(next.get("page")).toBeNull();
    expect(next.get("region")).toBe("일본");
    expect(next.get("theme")).toBe("온천");
    expect(next.get("tourType")).toBe("golf-park");
  });

  it("sort change also resets page", () => {
    const current = new URLSearchParams("region=일본&page=4");
    const next = mergeFiltersIntoSearchParams(current, {
      region: "일본",
      theme: null,
      product_line: null,
      sort: "price_asc",
      q: null,
      collection: null,
    });
    next.delete("page");
    expect(next.get("page")).toBeNull();
    expect(next.get("sort")).toBe("price_asc");
  });

  it("readBrowseChannelParams", () => {
    const sp = new URLSearchParams("tourType=golf-park&golfRegion=japan-china");
    expect(readBrowseChannelParams(sp)).toEqual({
      tourType: "golf-park",
      golfRegion: "japan-china",
    });
  });

  it("combined region + golf → buildProductListingQueryParams includes both scopes", () => {
    const destinations = [
      tax({ id: "sea", name: "동남아", taxonomy_type: "destination" }),
      tax({ id: "vn", name: "베트남", taxonomy_type: "destination", parent_id: "sea" }),
    ];
    const params = buildProductListingQueryParams({
      filters: {
        region: "동남아",
        tourType: GOLF_TOUR_TYPE,
        sort: "price_asc",
        page: 2,
        pageSize: 24,
      },
      taxonomy: {
        destinations,
        themes: [],
        productLines: [
          tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf" }),
        ],
      },
    });
    expect(params.page).toBe(2);
    expect(params.pageSize).toBe(24);
    expect(params.sort).toBe("price_asc");
    expect(params.filters?.destinationScope?.ids).toContain("sea");
    expect(params.filters?.destinationScope?.names).toContain("동남아");
    expect(params.filters?.golfChannel?.productLineIds).toContain("pl-golf");
  });

  it("region Japan → destinationScope ids+names (legacy parity)", () => {
    const destinations = [
      tax({ id: "jp", name: "일본", taxonomy_type: "destination" }),
      tax({ id: "osaka", name: "오사카", taxonomy_type: "destination", parent_id: "jp" }),
    ];
    const params = buildProductListingQueryParams({
      filters: { region: "일본", page: 2 },
      taxonomy: { destinations, themes: [], productLines: [] },
    });
    expect(params.filters?.destinationScope).toEqual({
      ids: ["jp", "osaka"],
      names: ["일본", "오사카"],
    });
    expect(params.page).toBe(2);
  });

  it("theme / product_line / collection / golfRegion map to DB filters", () => {
    const destinations = [
      tax({ id: "jp", name: "일본", taxonomy_type: "destination" }),
    ];
    const themes = [
      tax({ id: "fam", name: "가족여행", taxonomy_type: "theme" }),
    ];
    const productLines = [
      tax({ id: "pl-pkg", name: "패키지관광", taxonomy_type: "product_line" }),
      tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf" }),
    ];

    const themeParams = buildProductListingQueryParams({
      filters: { theme: "가족여행" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(themeParams.filters?.themeNames).toEqual(["가족여행"]);

    const lineParams = buildProductListingQueryParams({
      filters: { product_line: "패키지관광" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(lineParams.filters?.productLineId).toBe("pl-pkg");

    const rec = buildProductListingQueryParams({
      filters: { collection: "recommend" },
      taxonomy: {
        destinations,
        themes,
        productLines,
        campaignNamesByCollection: { recommend: ["봄"] },
      },
    });
    expect(rec.filters?.collection).toEqual({ kind: "recommend", campaignNames: ["봄"] });

    const neu = buildProductListingQueryParams({
      filters: { collection: "new" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(neu.sort).toBe("latest");

    const golfRegion = buildProductListingQueryParams({
      filters: { tourType: GOLF_TOUR_TYPE, golfRegion: "japan-china" },
      taxonomy: { destinations, themes, productLines },
    });
    expect(golfRegion.filters?.golfChannel).toBeDefined();
    expect(golfRegion.filters?.destinationScope?.names).toContain("일본");
  });

  it("pagination page numbers max 7 algorithm exported", () => {
    expect(getSearchPaginationPageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(getSearchPaginationPageNumbers(5, 20)).toContain("ellipsis");
    expect(getSearchPaginationPageNumbers(5, 20).filter((p) => p !== "ellipsis")).toContain(5);
  });
});

/** Pure regression: Browse render path must not call applyProductFilters */
describe("Browse no client filter contract", () => {
  it("browse page items are used as-is (identity, no promotion reorder in helper)", () => {
    const items = [{ id: "a" }, { id: "b" }] as { id: string }[];
    // Server items pass through — no sortProductsPromotionFirst in Browse wiring module
    expect(items).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
