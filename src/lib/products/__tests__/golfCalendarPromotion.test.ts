import { describe, expect, it } from "vitest";
import {
  GOLF_CALENDAR_PROMOTION_CAMPAIGN_SLUG,
  productHasPromotionCampaign,
  resolvePromotionCampaignDisplayLabel,
  resolvePromotionCampaignId,
} from "@/lib/products/golfCalendarPromotion";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function campaignTaxonomy(
  partial: Partial<ProductTaxonomy> & Pick<ProductTaxonomy, "id" | "name">,
): ProductTaxonomy {
  return {
    taxonomy_type: "campaign",
    slug: null,
    is_active: true,
    sort_order: null,
    created_at: null,
    is_hub_visible: false,
    is_landing_enabled: false,
    ...partial,
  };
}

describe("golfCalendarPromotion", () => {
  it("resolves promotion campaign id by slug", () => {
    const taxonomies = [
      campaignTaxonomy({ id: "camp-1", name: "추천", slug: "recommend" }),
      campaignTaxonomy({ id: "promo-1", name: "특가 기획", slug: "promotion" }),
    ];

    expect(resolvePromotionCampaignId(taxonomies)).toBe("promo-1");
    expect(GOLF_CALENDAR_PROMOTION_CAMPAIGN_SLUG).toBe("promotion");
  });

  it("resolves promotion display label from display_label", () => {
    const taxonomies = [
      campaignTaxonomy({
        id: "promo-1",
        name: "특가 기획",
        slug: "promotion",
        display_label: "시즌 특가",
      }),
    ];

    expect(resolvePromotionCampaignDisplayLabel(taxonomies)).toBe("시즌 특가");
  });

  it("detects promotion via campaign_card_meta taxonomyId", () => {
    const product = {
      id: "p1",
      title: "골프",
      campaign_card_meta: [{ taxonomyId: "promo-1", name: "특가", displayLabel: "특가" }],
    } as Product;

    expect(productHasPromotionCampaign(product, "promo-1")).toBe(true);
    expect(productHasPromotionCampaign(product, "other")).toBe(false);
  });

  it("detects promotion via campaigns uuid token", () => {
    const product = {
      id: "p2",
      title: "골프2",
      campaigns: ["promo-1"],
    } as Product;

    expect(productHasPromotionCampaign(product, "promo-1")).toBe(true);
  });
});
