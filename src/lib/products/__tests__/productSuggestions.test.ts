/**
 * POST-UI-01D-2B-2: Product suggestions slim query tests.
 */

import { describe, expect, it } from "vitest";
import { escapeForIlike } from "@/lib/search/searchCandidateFilters";
import { quotePostgrestValue } from "@/lib/products/productListingQuery";
import {
  PRODUCT_SUGGESTIONS_MAX,
  PRODUCT_SUGGESTION_SELECT,
  buildProductSuggestionOrFilter,
  getProductSuggestionItems,
  mapRowToProductSuggestionItem,
} from "@/lib/products/productSuggestions";

describe("ProductSuggestion projection", () => {
  it("select includes match fields + order cols, excludes heavy blobs", () => {
    const cols = PRODUCT_SUGGESTION_SELECT.split(",");
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "title",
        "description",
        "category",
        "theme",
        "sort_order",
        "created_at",
      ]),
    );
    expect(cols).not.toContain("*");
    for (const heavy of [
      "itinerary_v2_json",
      "overview_json",
      "package_catalog_json",
      "golf_courses_json",
      "images_json",
      "is_popular",
      "is_recommend",
    ]) {
      expect(cols).not.toContain(heavy);
    }
  });

  it("response mapper excludes description", () => {
    const item = mapRowToProductSuggestionItem({
      id: "p1",
      title: "다낭 골프",
      description: "secret body",
      category: "베트남",
      theme: "골프",
    });
    expect(item).toEqual({
      id: "p1",
      title: "다낭 골프",
      category: "베트남",
      theme: "골프",
    });
    expect(item).not.toHaveProperty("description");
  });

  it("null theme/category become empty string (legacy response shape)", () => {
    expect(
      mapRowToProductSuggestionItem({
        id: "p2",
        title: "T",
        category: null,
        theme: null,
      }),
    ).toEqual({ id: "p2", title: "T", category: "", theme: "" });
  });
});

describe("buildProductSuggestionOrFilter", () => {
  it("empty / whitespace → null (no DB filter)", () => {
    expect(buildProductSuggestionOrFilter("")).toBeNull();
    expect(buildProductSuggestionOrFilter("   ")).toBeNull();
  });

  it("builds title|description|category|theme ILIKE with escape + quote", () => {
    const filter = buildProductSuggestionOrFilter("일본");
    expect(filter).toContain("title.ilike.");
    expect(filter).toContain("description.ilike.");
    expect(filter).toContain("category.ilike.");
    expect(filter).toContain("theme.ilike.");
    const quoted = quotePostgrestValue(`%${escapeForIlike("일본")}%`);
    expect(filter).toBe(
      `title.ilike.${quoted},description.ilike.${quoted},category.ilike.${quoted},theme.ilike.${quoted}`,
    );
  });

  it("escapes % and _ in query", () => {
    const filter = buildProductSuggestionOrFilter("100%_off");
    expect(filter).toContain(quotePostgrestValue(`%${escapeForIlike("100%_off")}%`));
    expect(escapeForIlike("100%_off")).toBe("100\\%\\_off");
  });

  it("quotes commas and parens safely for PostgREST OR", () => {
    const filter = buildProductSuggestionOrFilter("a,b(c)");
    expect(filter?.startsWith("title.ilike.\"")).toBe(true);
    expect(filter).toContain(quotePostgrestValue(`%${escapeForIlike("a,b(c)")}%`));
  });

  it("lowercases query for contract parity with legacy trim+toLowerCase", () => {
    const a = buildProductSuggestionOrFilter("Golf");
    const b = buildProductSuggestionOrFilter("golf");
    expect(a).toBe(b);
  });

  it("Korean query builds substring pattern", () => {
    const filter = buildProductSuggestionOrFilter("온천");
    expect(filter).toContain(quotePostgrestValue("%온천%"));
  });
});

describe("getProductSuggestionItems empty q", () => {
  it("returns [] without throwing for empty query", async () => {
    expect(await getProductSuggestionItems("")).toEqual([]);
    expect(await getProductSuggestionItems("  ")).toEqual([]);
  });
});

describe("suggestions limits / select constants", () => {
  it("max is exactly 8", () => {
    expect(PRODUCT_SUGGESTIONS_MAX).toBe(8);
  });
});
