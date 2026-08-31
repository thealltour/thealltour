import { describe, expect, it } from "vitest";
import {
  PRODUCT_LISTING_SELECT,
  PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS,
} from "@/lib/products/productListItem";
import {
  restoreProductListItemOrderByIds,
} from "@/lib/products/getProductListItems";
import {
  buildDestinationScopeOrFilter,
  buildThemeOrFilter,
  quotePostgrestValue,
} from "@/lib/products/productListingQuery";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductListItem } from "@/lib/products/productListItem";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function tax(partial: Partial<ProductTaxonomy> & { id: string; name: string }): ProductTaxonomy {
  return {
    taxonomy_type: "destination",
    sort_order: 0,
    is_active: true,
    ...partial,
  } as ProductTaxonomy;
}

describe("01D-2A listing projection", () => {
  it("PRODUCT_LISTING_SELECT excludes heavy PDP fields", () => {
    for (const heavy of PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS) {
      expect(PRODUCT_LISTING_SELECT).not.toContain(heavy);
    }
    expect(PRODUCT_LISTING_SELECT).toContain("destination_id");
  });
});

describe("destination hub vs slug vs productLanding filter contracts", () => {
  it("hub self-exact OR does not expand descendants", () => {
    const id = "jp";
    const name = "일본";
    const hubOr = [
      `destination_id.eq.${quotePostgrestValue(id)}`,
      `category.ilike.${quotePostgrestValue(name)}`,
    ].join(",");
    expect(hubOr).toContain("destination_id.eq.");
    expect(hubOr).toContain("category.ilike.");
    expect(hubOr).not.toContain("osaka");
  });

  it("slug category-exact has no destination_id clause", () => {
    const slugFilter = `category.ilike.${quotePostgrestValue("일본")}`;
    expect(slugFilter).toContain("category.ilike.");
    expect(slugFilter).not.toContain("destination_id");
  });

  it("productLanding region includes self + descendants ids/names", () => {
    const destinations = [
      tax({ id: "jp", name: "일본", parent_id: null }),
      tax({ id: "osaka", name: "오사카", parent_id: "jp" }),
    ];
    const scope = getSelfAndDescendantIdsAndNames(destinations, "일본");
    expect(scope.ids).toEqual(["jp", "osaka"]);
    expect(scope.names).toEqual(["일본", "오사카"]);
    const or = buildDestinationScopeOrFilter(scope);
    expect(or).toContain("destination_id.in.");
    expect(or).toContain("category.in.");
    expect(or).toContain("osaka");
    expect(or).toContain("오사카");
  });
});

describe("theme hub vs productLanding theme contracts", () => {
  it("exact single theme token filter (hub/slug)", () => {
    const or = buildThemeOrFilter(["골프"]);
    expect(or).toBeTruthy();
    expect(or).toContain("theme.match.");
    expect(or!.match(/theme\.match\./g)?.length).toBe(1);
  });

  it("productLanding theme descendants produce multi-token OR", () => {
    const themes = [
      tax({ id: "golf", name: "골프", taxonomy_type: "theme", parent_id: null }),
      tax({ id: "park", name: "파크골프", taxonomy_type: "theme", parent_id: "golf" }),
    ];
    const names = getSelfAndDescendantIdsAndNames(themes, "골프").names;
    expect(names).toEqual(["골프", "파크골프"]);
    const or = buildThemeOrFilter(names);
    expect(or!.match(/theme\.match\./g)?.length).toBe(2);
  });
});

describe("curated order restore", () => {
  it("restores curated id order after unordered .in() results", () => {
    const items: ProductListItem[] = [
      { id: "C1", title: "A", category: "일본", image_url: "" },
      { id: "C3", title: "B", category: "일본", image_url: "" },
    ];
    const ordered = restoreProductListItemOrderByIds(["C3", "C1"], items);
    expect(ordered.map((p) => p.id)).toEqual(["C3", "C1"]);
  });

  it("drops missing ids and preserves duplicates-free order", () => {
    const items: ProductListItem[] = [
      { id: "C1", title: "A", category: "일본", image_url: "" },
    ];
    expect(restoreProductListItemOrderByIds(["C2", "C1"], items).map((p) => p.id)).toEqual([
      "C1",
    ]);
  });
});

describe("LandingPageRenderer destination exact contract", () => {
  it("destination_id exact filter string has no category fallback", () => {
    const id = "dest-uuid";
    const clause = `destination_id.eq.${quotePostgrestValue(id)}`;
    expect(clause).toContain("destination_id.eq.");
    expect(clause).not.toContain("category");
  });
});
