import { describe, expect, it } from "vitest";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { mapProductRowToListItem } from "@/lib/products/productListItem";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

describe("hydrateProductsWithCampaignCardMeta with ProductListItem", () => {
  it("hydrates campaign_card_meta on listing DTO rows", () => {
    const taxonomies: ProductTaxonomy[] = [
      {
        id: "camp-1",
        taxonomy_type: "campaign",
        name: "추천",
        display_label: "추천 여행",
        badge_priority: 1,
        badge_visible: true,
        badge_tone: "primary",
        slug: "recommend",
      },
    ];
    const item = mapProductRowToListItem({
      id: "p1",
      title: "Test",
      category: "일본",
      campaigns_json: ["추천"],
    });
    const [hydrated] = hydrateProductsWithCampaignCardMeta([item], taxonomies);
    expect(hydrated.campaign_card_meta).toHaveLength(1);
    expect(hydrated.campaign_card_meta?.[0]?.displayLabel).toBe("추천 여행");
    expect(hydrated.campaign_card_meta?.[0]?.badge_visible).toBe(true);
    expect(hydrated.campaign_card_meta?.[0]?.badge_tone).toBe("primary");
  });
});
