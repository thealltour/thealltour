import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import { sortRelatedProducts } from "@/lib/products/relatedProductScoring";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "current",
    title: "Current",
    description: "",
    image_url: "/i.jpg",
    category: "일본",
    theme: "골프",
    destination_id: "dest-1",
    ...overrides,
  };
}

function promoMeta(): ProductCampaignCardMeta {
  return {
    name: "promotion",
    displayLabel: "시즌 / 특가",
    badge_priority: 1,
    badge_visible: true,
    badge_tone: "neutral",
    isPromotionCampaign: true,
  };
}

describe("sortRelatedProducts promotion priority", () => {
  it("관련도 점수가 낮아도 promotion 상품이 먼저", () => {
    const current = baseProduct({ id: "current" });
    const highScore = baseProduct({
      id: "high",
      destination_id: "dest-1",
      category: "일본",
      theme: "골프",
    });
    const promoLowScore = baseProduct({
      id: "promo",
      destination_id: "other",
      category: "태국",
      theme: "휴양",
      campaign_card_meta: [promoMeta()],
    });
    const sorted = sortRelatedProducts(current, [highScore, promoLowScore]);
    expect(sorted[0]?.id).toBe("promo");
    expect(sorted[1]?.id).toBe("high");
  });
});
