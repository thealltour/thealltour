import { describe, expect, it } from "vitest";
import {
  buildProductListingQueryParams,
  resolveListingSortFromUrl,
} from "@/lib/products/buildProductListingQueryParams";
import { PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE } from "@/lib/productFilters";
import { GOLF_PRESET_CATEGORIES, GOLF_TOUR_TYPE } from "@/lib/products/golfChannel";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

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

const destinations: ProductTaxonomy[] = [
  tax({ id: "asia", name: "해외", taxonomy_type: "destination" }),
  tax({ id: "jp", name: "일본", taxonomy_type: "destination", parent_id: "asia" }),
  tax({ id: "tokyo", name: "도쿄", taxonomy_type: "destination", parent_id: "jp" }),
];

const themes: ProductTaxonomy[] = [
  tax({ id: "golf", name: "골프", taxonomy_type: "theme" }),
  tax({ id: "park", name: "파크골프", taxonomy_type: "theme", parent_id: "golf" }),
];

const productLines = [
  tax({ id: "pl-pkg", name: "패키지관광", taxonomy_type: "product_line" }),
  tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf" }),
];

describe("buildProductListingQueryParams", () => {
  it("maps region descendants, theme descendants, product line, collection, golf", () => {
    const params = buildProductListingQueryParams({
      filters: {
        region: "일본",
        theme: "골프",
        product_line: "패키지관광",
        collection: "recommend",
        tourType: GOLF_TOUR_TYPE,
        sort: "popular",
        page: 2,
        pageSize: 24,
      },
      taxonomy: {
        destinations,
        themes,
        productLines,
        campaignNamesByCollection: { recommend: ["봄"] },
      },
    });

    expect(params.page).toBe(2);
    expect(params.pageSize).toBe(24);
    expect(params.sort).toBe("recommended");
    expect(params.filters).toMatchObject({
      destinationScope: {
        ids: ["jp", "tokyo"],
        names: ["일본", "도쿄"],
      },
      themeNames: ["골프", "파크골프"],
      productLineId: "pl-pkg",
      collection: { kind: "recommend", campaignNames: ["봄"] },
      golfChannel: {
        productLineIds: ["pl-golf"],
        legacyCategories: [...GOLF_PRESET_CATEGORIES],
      },
    });
  });

  it("region Japan includes Osaka legacy name in destinationScope", () => {
    const withOsaka = [
      ...destinations,
      tax({
        id: "osaka",
        name: "오사카",
        taxonomy_type: "destination",
        parent_id: "jp",
      }),
    ];
    const params = buildProductListingQueryParams({
      filters: { region: "일본" },
      taxonomy: { destinations: withOsaka, themes, productLines },
    });
    expect(params.filters?.destinationScope?.ids).toEqual(["jp", "tokyo", "osaka"]);
    expect(params.filters?.destinationScope?.names).toEqual(["일본", "도쿄", "오사카"]);
  });

  it("packages unassigned product line and collection=new sort", () => {
    expect(
      buildProductListingQueryParams({
        filters: {
          productLine: PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
          collection: "new",
        },
        taxonomy: { destinations, themes, productLines },
      }),
    ).toMatchObject({
      sort: "latest",
      filters: { unassignedProductLine: true },
    });
    expect(resolveListingSortFromUrl({ collection: "new" })).toBe("latest");
  });
});
