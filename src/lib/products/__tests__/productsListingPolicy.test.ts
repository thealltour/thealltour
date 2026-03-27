import { describe, expect, it } from "vitest";
import type { ProductFiltersState } from "@/lib/productFilters";
import { mergeFiltersIntoSearchParams } from "@/lib/productFilters";
import {
  hasCanonicalListingFilterParams,
  hasLandingEntryParams,
  resolveProductsPageInitialFilters,
  shouldPreferServerInitialFilters,
} from "@/lib/products/productsListingPolicy";

function sp(entries: Record<string, string>) {
  const u = new URLSearchParams(entries);
  return u;
}

const serverFilters: ProductFiltersState = {
  region: "일본",
  theme: "골프",
  product_line: null,
  sort: "popular",
  q: null,
  collection: null,
};

describe("productsListingPolicy", () => {
  it("hasLandingEntryParams: destination/city/theme 중 하나면 true", () => {
    expect(hasLandingEntryParams(sp({ destination: "x" }))).toBe(true);
    expect(hasLandingEntryParams(sp({ city: "서울" }))).toBe(true);
    expect(hasLandingEntryParams(sp({ theme: "golf" }))).toBe(true);
    expect(hasLandingEntryParams(sp({ region: "일본" }))).toBe(false);
  });

  it("hasCanonicalListingFilterParams: region/theme/product_line/sort/q 만 본다 (collection 제외)", () => {
    expect(hasCanonicalListingFilterParams(sp({ collection: "popular" }))).toBe(false);
    expect(hasCanonicalListingFilterParams(sp({ tourType: "x" }))).toBe(false);
    expect(hasCanonicalListingFilterParams(sp({ region: "일본" }))).toBe(true);
    expect(hasCanonicalListingFilterParams(sp({ theme: "골프" }))).toBe(true);
    expect(hasCanonicalListingFilterParams(sp({ product_line: "pkg" }))).toBe(true);
    expect(hasCanonicalListingFilterParams(sp({ sort: "latest" }))).toBe(true);
    expect(hasCanonicalListingFilterParams(sp({ q: "제주" }))).toBe(true);
  });

  it("shouldPreferServerInitialFilters: 서버 초기값 없으면 false", () => {
    expect(shouldPreferServerInitialFilters(sp({}), null)).toBe(false);
    expect(shouldPreferServerInitialFilters(sp({ destination: "x" }), null)).toBe(false);
  });

  it("resolveProductsPageInitialFilters: 랜딩 파라미 + 서버 초기 → 서버", () => {
    const r = resolveProductsPageInitialFilters(
      sp({ destination: "tokyo", q: "검색어" }),
      serverFilters,
    );
    expect(r).toEqual(serverFilters);
  });

  it("resolveProductsPageInitialFilters: canonical 없고 서버 초기 → 서버 (허브 첫 진입)", () => {
    const r = resolveProductsPageInitialFilters(sp({}), serverFilters);
    expect(r).toEqual(serverFilters);
  });

  it("resolveProductsPageInitialFilters: canonical 있으면 URL 파싱 (서버 있어도)", () => {
    const r = resolveProductsPageInitialFilters(
      sp({ region: "미국", sort: "latest" }),
      serverFilters,
    );
    expect(r.region).toBe("미국");
    expect(r.sort).toBe("latest");
    expect(r.theme).toBeNull();
  });

  it("resolveProductsPageInitialFilters: canonical + collection 이면 collection도 URL 기준 유지", () => {
    const r = resolveProductsPageInitialFilters(
      sp({ region: "미국", collection: "popular" }),
      serverFilters,
    );
    expect(r.region).toBe("미국");
    expect(r.collection).toBe("popular");
  });

  it("resolveProductsPageInitialFilters: collection 만 있으면 canonical 아님 → 서버 우선", () => {
    const r = resolveProductsPageInitialFilters(sp({ collection: "popular" }), serverFilters);
    expect(r).toEqual(serverFilters);
  });

  it("resolveProductsPageInitialFilters: destination+city 없이 sort만 있으면 URL 우선 (테마+정렬)", () => {
    const r = resolveProductsPageInitialFilters(
      sp({ theme: "골프", sort: "latest" }),
      serverFilters,
    );
    expect(r.theme).toBe("골프");
    expect(r.sort).toBe("latest");
  });

  it("resolveProductsPageInitialFilters: URL에 region 있으면 theme+서버 있어도 URL 우선 (테마 후 지역 조합)", () => {
    const serverHub: ProductFiltersState = {
      region: "일본",
      theme: null,
      product_line: null,
      sort: "",
      q: null,
      collection: null,
    };
    const r = resolveProductsPageInitialFilters(
      sp({ theme: "액티비티", region: "미국" }),
      serverHub,
    );
    expect(r.region).toBe("미국");
    expect(r.theme).toBe("액티비티");
  });

  it("mergeFiltersIntoSearchParams: region null이면 쿼리에서 region 제거", () => {
    const cur = new URLSearchParams("region=일본&theme=골프");
    const out = mergeFiltersIntoSearchParams(cur, {
      region: null,
      theme: "골프",
      product_line: null,
      sort: "",
      q: null,
      collection: null,
    });
    expect(out.get("region")).toBeNull();
    expect(out.get("theme")).toBe("골프");
  });

  it("mergeFiltersIntoSearchParams: collection null이면 제거되고 tourType은 유지", () => {
    const cur = new URLSearchParams("collection=recommend&tourType=golf&theme=골프");
    const out = mergeFiltersIntoSearchParams(cur, {
      region: null,
      theme: "골프",
      product_line: null,
      sort: "",
      q: null,
      collection: null,
    });
    expect(out.get("collection")).toBeNull();
    expect(out.get("tourType")).toBe("golf");
    expect(out.get("theme")).toBe("골프");
  });

  it("resolveProductsPageInitialFilters: theme URL만 있고 서버 초기 있으면 서버 유지 (랜딩 슬러그 해석)", () => {
    const resolved: ProductFiltersState = {
      region: null,
      theme: "해석된테마",
      product_line: null,
      sort: "",
      q: null,
      collection: null,
    };
    const r = resolveProductsPageInitialFilters(sp({ theme: "raw-slug" }), resolved);
    expect(r).toEqual(resolved);
  });
});
