import { describe, expect, it } from "vitest";
import {
  filterGolfChannelProducts,
  isGolfChannelProduct,
  isGolfProductLineTaxonomy,
} from "@/lib/products/golfChannel";
import type { Product } from "@/types/product";

function product(partial: Partial<Product> & Pick<Product, "id" | "title">): Product {
  return {
    id: partial.id,
    title: partial.title,
    category: partial.category,
    product_line_id: partial.product_line_id,
    departures: partial.departures,
    departure_from_date: partial.departure_from_date,
  } as Product;
}

describe("golfChannel", () => {
  it("detects golf product lines by taxonomy name", () => {
    expect(isGolfProductLineTaxonomy({ name: "골프투어" })).toBe(true);
    expect(isGolfProductLineTaxonomy({ name: "파크골프투어" })).toBe(true);
    expect(isGolfProductLineTaxonomy({ name: "휴양" })).toBe(false);
  });

  it("matches products by product_line_id", () => {
    const map = { pl1: "골프투어" };
    expect(
      isGolfChannelProduct(
        product({ id: "1", title: "A", product_line_id: "pl1", category: "일본" }),
        map,
      ),
    ).toBe(true);
  });

  it("falls back to legacy category names", () => {
    expect(
      isGolfChannelProduct(product({ id: "2", title: "B", category: "파크골프투어" }), {}),
    ).toBe(true);
    expect(isGolfChannelProduct(product({ id: "3", title: "C", category: "일본" }), {})).toBe(false);
  });

  it("filters golf channel products", () => {
    const products = [
      product({ id: "1", title: "Golf", product_line_id: "pl1", category: "일본" }),
      product({ id: "2", title: "Package", category: "일본" }),
    ];
    const filtered = filterGolfChannelProducts(products, { pl1: "골프투어" });
    expect(filtered.map((p) => p.id)).toEqual(["1"]);
  });
});
