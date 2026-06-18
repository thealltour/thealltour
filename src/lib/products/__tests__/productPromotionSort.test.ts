import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import {
  productHasPromotionFromMeta,
  sortProductsPromotionFirst,
} from "@/lib/products/productPromotionSort";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "T",
    description: "",
    image_url: "/i.jpg",
    category: "일본",
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

describe("productPromotionSort", () => {
  it("productHasPromotionFromMeta: isPromotionCampaign + visible 만 true", () => {
    expect(
      productHasPromotionFromMeta(
        baseProduct({
          campaign_card_meta: [promoMeta()],
        }),
      ),
    ).toBe(true);
    expect(
      productHasPromotionFromMeta(
        baseProduct({
          campaign_card_meta: [{ ...promoMeta(), badge_visible: false }],
        }),
      ),
    ).toBe(false);
    expect(productHasPromotionFromMeta(baseProduct({}))).toBe(false);
  });

  it("sortProductsPromotionFirst: promotion 상품을 앞으로, 내부 순서 유지", () => {
    const a = baseProduct({ id: "a" });
    const b = baseProduct({
      id: "b",
      campaign_card_meta: [promoMeta()],
    });
    const c = baseProduct({ id: "c" });
    const d = baseProduct({
      id: "d",
      campaign_card_meta: [promoMeta()],
    });
    const sorted = sortProductsPromotionFirst([a, b, c, d]);
    expect(sorted.map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
  });
});
