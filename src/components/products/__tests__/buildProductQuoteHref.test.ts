import { describe, expect, it } from "vitest";
import { buildProductQuoteHref } from "@/components/products/ProductDetailBookingZone";

describe("buildProductQuoteHref", () => {
  it("product_id와 source_path를 항상 포함한다", () => {
    expect(
      buildProductQuoteHref({
        productId: "abc",
        sourcePath: "/products/abc",
      }),
    ).toBe("/quote?product_id=abc&source_path=%2Fproducts%2Fabc");
  });

  it("ymd가 있을 때만 desired_departure를 채운다", () => {
    expect(
      buildProductQuoteHref({
        productId: "abc",
        sourcePath: "/products/abc",
        desiredDepartureYmd: "2026-05-10",
      }),
    ).toContain("desired_departure=2026-05-10");

    expect(
      buildProductQuoteHref({
        productId: "abc",
        sourcePath: "/products/abc",
        desiredDepartureYmd: null,
      }),
    ).not.toContain("desired_departure");
  });
});
