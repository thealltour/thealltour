import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import { applyProductFilters } from "@/lib/productFilters";
import { productCatalogMatchesKeyword } from "@/lib/products/productCatalogKeyword";
import {
  buildProductsKeywordHaystack,
  tokenizeCatalogKeyword,
  tokenizeListingQueryKeyword,
} from "@/lib/products/productsSearchPolicy";

function p(overrides: Partial<Product>): Product {
  return {
    id: "1",
    title: "제주 골프",
    description: "바다 코스",
    image_url: "/x.jpg",
    category: "제주",
    theme: "골프",
    ...overrides,
  };
}

describe("productsSearchPolicy", () => {
  it("buildProductsKeywordHaystack: title/description/category/theme 소문자 연결", () => {
    expect(buildProductsKeywordHaystack(p({}))).toContain("제주");
    expect(buildProductsKeywordHaystack(p({}))).toContain("골프");
  });

  it("tokenizeListingQueryKeyword: 공백 분리 (연속 공백 제거)", () => {
    expect(tokenizeListingQueryKeyword("a  b")).toEqual(["a", "b"]);
  });

  it("tokenizeCatalogKeyword: 쉼표·공백 복합 분리", () => {
    expect(tokenizeCatalogKeyword("골프, 제주")).toEqual(["골프", "제주"]);
  });

  it("listing q: 공백 토큰은 OR(일부 매칭) — applyProductFilters 동작 고정", () => {
    const products = [
      p({ id: "a", title: "AAA", description: "" }),
      p({ id: "b", title: "BBB", description: "" }),
    ];
    const matched = applyProductFilters(products, {
      region: null,
      theme: null,
      product_line: null,
      sort: "",
      q: "aaa bbb",
      collection: null,
    });
    expect(matched.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("catalog keyword: 쉼표 토큰 — productCatalogMatchesKeyword 동작 고정", () => {
    const product = p({ title: "제주", description: "골프장" });
    expect(productCatalogMatchesKeyword(product, "없음, 제주")).toBe(true);
    expect(productCatalogMatchesKeyword(product, "없음,오사카")).toBe(false);
  });
});
