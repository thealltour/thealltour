import { describe, expect, it } from "vitest";
import {
  isDomesticDestinationTaxonomy,
  shouldShowCoupangBannerForRegionSlug,
} from "@/lib/affiliate/isDomesticDestinationTaxonomy";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function tax(
  partial: Partial<ProductTaxonomy> & Pick<ProductTaxonomy, "id" | "name">,
): ProductTaxonomy {
  return {
    slug: null,
    taxonomy_type: "destination",
    is_active: true,
    sort_order: 0,
    created_at: null,
    parent_id: null,
    is_hub_visible: true,
    is_landing_enabled: true,
    ...partial,
  };
}

const hub: ProductTaxonomy[] = [
  tax({ id: "overseas", name: "해외" }),
  tax({ id: "domestic", name: "국내", slug: "domestic" }),
  tax({ id: "jeju", name: "제주", parent_id: "domestic", slug: "jeju" }),
  tax({ id: "japan", name: "일본", parent_id: "overseas", slug: "japan" }),
];

describe("isDomesticDestinationTaxonomy", () => {
  it("국내 root → true", () => {
    expect(isDomesticDestinationTaxonomy(hub[1], hub)).toBe(true);
  });

  it("국내 descendant (제주) → true", () => {
    expect(isDomesticDestinationTaxonomy(hub[2], hub)).toBe(true);
  });

  it("해외 descendant (일본) → false", () => {
    expect(isDomesticDestinationTaxonomy(hub[3], hub)).toBe(false);
  });

  it("해외 root → false", () => {
    expect(isDomesticDestinationTaxonomy(hub[0], hub)).toBe(false);
  });
});

describe("shouldShowCoupangBannerForRegionSlug", () => {
  it("domestic slug with matched destination → true", () => {
    expect(
      shouldShowCoupangBannerForRegionSlug({
        slug: "domestic",
        matchedDestination: hub[1],
        hubDestinations: hub,
      }),
    ).toBe(true);
  });

  it("jeju (domestic child) → true", () => {
    expect(
      shouldShowCoupangBannerForRegionSlug({
        slug: "jeju",
        matchedDestination: hub[2],
        hubDestinations: hub,
      }),
    ).toBe(true);
  });

  it("japan (overseas) → false", () => {
    expect(
      shouldShowCoupangBannerForRegionSlug({
        slug: "japan",
        matchedDestination: hub[3],
        hubDestinations: hub,
      }),
    ).toBe(false);
  });

  it("no matched destination → false", () => {
    expect(
      shouldShowCoupangBannerForRegionSlug({
        slug: "unknown",
        matchedDestination: null,
        hubDestinations: hub,
      }),
    ).toBe(false);
  });
});
