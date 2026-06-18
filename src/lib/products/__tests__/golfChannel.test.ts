import { describe, expect, it } from "vitest";
import {
  buildGolfProductsHref,
  filterGolfChannelProducts,
  filterGolfProductsByRegionPreset,
  isGolfChannelProduct,
  isGolfProductLineTaxonomy,
  parseGolfHeroRegions,
  resolveGolfHeroRegionPreset,
} from "@/lib/products/golfChannel";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function product(partial: Partial<Product> & Pick<Product, "id" | "title">): Product {
  return {
    id: partial.id,
    title: partial.title,
    category: partial.category,
    product_line_id: partial.product_line_id,
    destination_id: partial.destination_id,
    departures: partial.departures,
    departure_from_date: partial.departure_from_date,
  } as Product;
}

function destinationTaxonomy(
  partial: Partial<ProductTaxonomy> & Pick<ProductTaxonomy, "id" | "name">,
): ProductTaxonomy {
  return {
    taxonomy_type: "destination",
    slug: null,
    is_active: true,
    sort_order: null,
    created_at: null,
    is_hub_visible: false,
    is_landing_enabled: false,
    ...partial,
  };
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

  it("builds golf region preset href", () => {
    expect(buildGolfProductsHref({ golfRegion: "japan-china" })).toBe(
      "/products?tourType=golf-park&golfRegion=japan-china",
    );
  });

  it("parses golf hero regions with golfRegion preset", () => {
    const items = parseGolfHeroRegions(
      JSON.stringify([
        { id: "golf-japan-china", label: "일본/중국 골프투어", golfRegion: "japan-china" },
      ]),
    );
    expect(items[0]?.golfRegion).toBe("japan-china");
    expect(resolveGolfHeroRegionPreset(items[0]!)).toBe("japan-china");
  });

  it("maps legacy golf hero ids to presets", () => {
    expect(
      resolveGolfHeroRegionPreset({
        id: "golf-japan",
        label: "일본 골프투어",
        searchKeyword: "일본 골프",
      }),
    ).toBe("japan-china");
    expect(
      resolveGolfHeroRegionPreset({
        id: "golf-domestic",
        label: "국내 골프/파크골프",
        searchKeyword: "국내 골프",
      }),
    ).toBe("overseas");
  });
});

describe("filterGolfProductsByRegionPreset", () => {
  const taxonomies = [
    destinationTaxonomy({ id: "overseas", name: "해외" }),
    destinationTaxonomy({ id: "japan", name: "일본", parent_id: "overseas" }),
    destinationTaxonomy({ id: "china", name: "중국", parent_id: "overseas" }),
    destinationTaxonomy({ id: "tokyo", name: "도쿄", parent_id: "japan" }),
    destinationTaxonomy({ id: "domestic", name: "국내" }),
    destinationTaxonomy({ id: "jeju", name: "제주", parent_id: "domestic" }),
  ];

  const golfProducts = [
    product({
      id: "jp",
      title: "일본 골프",
      product_line_id: "pl1",
      destination_id: "tokyo",
    }),
    product({
      id: "cn",
      title: "중국 골프",
      product_line_id: "pl1",
      destination_id: "china",
    }),
    product({
      id: "kr",
      title: "제주 골프",
      product_line_id: "pl1",
      destination_id: "jeju",
    }),
  ];

  const nameMap = { pl1: "골프투어", tokyo: "도쿄", china: "중국", jeju: "제주" };

  it("filters japan-china preset by destination taxonomy descendants", () => {
    const filtered = filterGolfProductsByRegionPreset(
      golfProducts,
      "japan-china",
      taxonomies,
      nameMap,
    );
    expect(filtered.map((p) => p.id).sort()).toEqual(["cn", "jp"]);
  });

  it("filters overseas preset excluding domestic-only destinations", () => {
    const filtered = filterGolfProductsByRegionPreset(
      golfProducts,
      "overseas",
      taxonomies,
      nameMap,
    );
    expect(filtered.map((p) => p.id).sort()).toEqual(["cn", "jp"]);
  });
});
