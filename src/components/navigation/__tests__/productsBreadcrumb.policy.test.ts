import { describe, expect, it } from "vitest";
import { buildProductsBreadcrumbItems } from "@/components/navigation/breadcrumb-config";

describe("buildProductsBreadcrumbItems policy", () => {
  it("index", () => {
    expect(buildProductsBreadcrumbItems("index", { currentLabel: "_" })).toEqual([
      { label: "홈", href: "/" },
      { label: "여행상품" },
    ]);
  });

  it("product_detail", () => {
    expect(buildProductsBreadcrumbItems("product_detail", { currentLabel: "상품A" })).toEqual([
      { label: "홈", href: "/" },
      { label: "여행상품", href: "/products" },
      { label: "상품A" },
    ]);
  });

  it("region", () => {
    expect(buildProductsBreadcrumbItems("region", { currentLabel: "일본" })).toEqual([
      { label: "홈", href: "/" },
      { label: "여행상품", href: "/products" },
      { label: "지역별 상품", href: "/products/region" },
      { label: "일본" },
    ]);
  });

  it("theme", () => {
    expect(buildProductsBreadcrumbItems("theme", { currentLabel: "골프" })).toEqual([
      { label: "홈", href: "/" },
      { label: "여행상품", href: "/products" },
      { label: "테마별 상품", href: "/products/theme" },
      { label: "골프" },
    ]);
  });
});
