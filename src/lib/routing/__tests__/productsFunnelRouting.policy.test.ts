import { describe, expect, it } from "vitest";
import { getFallbackPath } from "@/lib/navigation/getFallbackPath";
import {
  getProductsNavPathKind,
  showProductsNavigationContext,
} from "@/lib/navigation/productsNavigationPolicy";
import { getProductsFunnelPathKind } from "@/lib/routing/getProductsFunnelPathKind";

const CASES: { path: string; kind: ReturnType<typeof getProductsFunnelPathKind> }[] = [
  { path: "/products", kind: "products_root" },
  { path: "/products/region", kind: "products_region_hub" },
  { path: "/products/theme", kind: "products_theme_hub" },
  { path: "/products/region/japan", kind: "products_region_landing" },
  { path: "/products/theme/golf", kind: "products_theme_landing" },
  { path: "/products/123", kind: "products_product_detail" },
  { path: "/products/region/japan/extra", kind: "products_other" },
  { path: "/products/theme/golf/extra", kind: "products_other" },
  { path: "/products/unknown-segment", kind: "products_product_detail" },
  { path: "/outside-path", kind: "outside" },
];

describe("productsFunnelRouting policy", () => {
  it.each(CASES)("getProductsFunnelPathKind($path) === $kind", ({ path, kind }) => {
    expect(getProductsFunnelPathKind(path)).toBe(kind);
  });

  it("showProductsNavigationContext: products_other·outside 는 false", () => {
    expect(showProductsNavigationContext("/products")).toBe(true);
    expect(showProductsNavigationContext("/products/region/japan")).toBe(true);
    expect(showProductsNavigationContext("/products/region/japan/extra")).toBe(false);
    expect(showProductsNavigationContext("/outside-path")).toBe(false);
  });

  it("getProductsNavPathKind 스냅샷", () => {
    expect(getProductsNavPathKind("/products")).toBe("products_index");
    expect(getProductsNavPathKind("/products/region")).toBe("products_region_hub");
    expect(getProductsNavPathKind("/products/theme")).toBe("products_theme_hub");
    expect(getProductsNavPathKind("/products/region/japan")).toBe("products_region");
    expect(getProductsNavPathKind("/products/theme/golf")).toBe("products_theme");
    expect(getProductsNavPathKind("/products/123")).toBe("product_detail");
    expect(getProductsNavPathKind("/products/region/japan/extra")).toBe("unknown");
    expect(getProductsNavPathKind("/outside-path")).toBe("unknown");
  });

  it("getFallbackPath 스냅샷", () => {
    expect(getFallbackPath("/products")).toBe("/");
    expect(getFallbackPath("/products/region/japan")).toBe("/products/region");
    expect(getFallbackPath("/products/region")).toBe("/products");
    expect(getFallbackPath("/products/theme/golf")).toBe("/products/theme");
    expect(getFallbackPath("/products/theme")).toBe("/products");
    expect(getFallbackPath("/products/123")).toBe("/products");
    expect(getFallbackPath("/products/region/japan/extra")).toBe("/products");
    expect(getFallbackPath("/outside-path")).toBe("/");
  });
});
