import { describe, expect, it } from "vitest";
import {
  productHasPromotionCampaignMeta,
  resolveDepartureUiForProduct,
  resolveProductBookingUxMode,
} from "@/lib/products/resolveProductBookingUx";
import type { Product } from "@/types/product";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "테스트 상품",
    ...overrides,
  } as Product;
}

describe("resolveProductBookingUxMode", () => {
  it("returns seasonal_consult when seasonal_price_bands exist", () => {
    const product = baseProduct({
      seasonal_price_bands: { offSeason: 100000, weekend: null, peakSeason: null },
      campaign_card_meta: [{ name: "promo", displayLabel: "특가", badge_priority: 1, badge_visible: true, badge_tone: "primary", isPromotionCampaign: true }],
      departureSchedules: [{ departureDate: "2026-07-01", returnDate: null, price: 120000, label: null, status: "AVAILABLE" }],
    });
    expect(resolveProductBookingUxMode(product)).toBe("seasonal_consult");
  });

  it("returns promotion_fixed for promotion + schedules", () => {
    const product = baseProduct({
      campaign_card_meta: [{
        name: "promotion",
        displayLabel: "특가",
        badge_priority: 1,
        badge_visible: true,
        badge_tone: "highlight",
        isPromotionCampaign: true,
      }],
      departureSchedules: [{ departureDate: "2026-07-01", returnDate: null, price: 120000, label: null, status: "AVAILABLE" }],
    });
    expect(resolveProductBookingUxMode(product)).toBe("promotion_fixed");
    expect(resolveDepartureUiForProduct(product)).toBe("chips");
  });

  it("returns calendar_booking for general products", () => {
    const product = baseProduct({
      departureSchedules: [{ departureDate: "2026-07-01", returnDate: null, price: 120000, label: null, status: "AVAILABLE" }],
    });
    expect(resolveProductBookingUxMode(product)).toBe("calendar_booking");
    expect(resolveDepartureUiForProduct(product)).toBe("calendar");
  });

  it("detects promotion campaign meta", () => {
    expect(productHasPromotionCampaignMeta(baseProduct())).toBe(false);
    expect(
      productHasPromotionCampaignMeta(
        baseProduct({
          campaign_card_meta: [{
            name: "x",
            displayLabel: "특가",
            badge_priority: 1,
            badge_visible: true,
            badge_tone: "primary",
            isPromotionCampaign: true,
          }],
        }),
      ),
    ).toBe(true);
  });
});
