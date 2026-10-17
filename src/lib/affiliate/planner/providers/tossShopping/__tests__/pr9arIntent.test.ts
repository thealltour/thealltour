import { describe, expect, it } from "vitest";
import {
  selectTossTravelGoodsIntents,
  TOSS_TRAVEL_GOODS_MAX_INTENTS,
  type TossIntentContext,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingIntent";

function ctx(overrides: Partial<TossIntentContext> = {}): TossIntentContext {
  return {
    destinationCountryCode: "JP",
    durationDays: 4,
    interests: [],
    itineraryTexts: [],
    hasRentalCarOffer: false,
    ...overrides,
  };
}

describe("PR-9AR Toss travel_goods intents", () => {
  it("power_bank for safe overseas context", () => {
    expect(selectTossTravelGoodsIntents(ctx({ destinationCountryCode: "JP" }))).toContain(
      "power_bank",
    );
  });

  it("no power_bank for domestic KR", () => {
    expect(selectTossTravelGoodsIntents(ctx({ destinationCountryCode: "KR" }))).not.toContain(
      "power_bank",
    );
  });

  it("waterproof_pouch when itinerary has water/beach signal", () => {
    const intents = selectTossTravelGoodsIntents(
      ctx({ itineraryTexts: ["오키나와 해변 산책", "시내 쇼핑"] }),
    );
    expect(intents).toContain("waterproof_pouch");
  });

  it("car_charger only when rental_car offer exists", () => {
    expect(selectTossTravelGoodsIntents(ctx({ hasRentalCarOffer: false }))).not.toContain(
      "car_charger",
    );
    expect(selectTossTravelGoodsIntents(ctx({ hasRentalCarOffer: true }))).toContain("car_charger");
  });

  it("unsupported / no signal → empty", () => {
    expect(
      selectTossTravelGoodsIntents(
        ctx({
          destinationCountryCode: null,
          durationDays: 3,
          itineraryTexts: ["시내 박물관"],
          hasRentalCarOffer: false,
        }),
      ),
    ).toEqual([]);
  });

  it("caps at 3 intents without duplicates", () => {
    const intents = selectTossTravelGoodsIntents(
      ctx({
        destinationCountryCode: "IT",
        durationDays: 10,
        itineraryTexts: ["카프리 섬 보트", "해변"],
        hasRentalCarOffer: true,
      }),
    );
    expect(intents.length).toBeLessThanOrEqual(TOSS_TRAVEL_GOODS_MAX_INTENTS);
    expect(new Set(intents).size).toBe(intents.length);
    expect(intents).toEqual(["car_charger", "waterproof_pouch", "power_bank"]);
  });

  it("does not emit travel_adapter without plug SSOT", () => {
    const intents = selectTossTravelGoodsIntents(
      ctx({ destinationCountryCode: "US", durationDays: 14, hasRentalCarOffer: true }),
    );
    expect(intents).not.toContain("travel_adapter");
  });

  it("luggage only for long trips", () => {
    expect(selectTossTravelGoodsIntents(ctx({ durationDays: 5 }))).not.toContain("luggage");
    expect(selectTossTravelGoodsIntents(ctx({ durationDays: 7 }))).toContain("luggage");
  });
});
