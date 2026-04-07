import { describe, expect, it } from "vitest";
import {
  getProductCardSeasonalBandInfo,
  getSeasonalCardMainLineFull,
} from "@/lib/products/productCardSeasonalPriceDisplay";

describe("productCardSeasonalPriceDisplay", () => {
  it("shows offSeason amount when offSeason set", () => {
    const bands = { offSeason: 700_000, weekend: 900_000, peakSeason: 1_000_000 };
    const info = getProductCardSeasonalBandInfo(bands)!;
    expect(getSeasonalCardMainLineFull(bands, info)).toBe("최저 ₩700,000~");
  });

  it("uses min amount when offSeason missing", () => {
    const bands = { weekend: 900_000, peakSeason: 1_000_000 };
    const info = getProductCardSeasonalBandInfo(bands)!;
    expect(getSeasonalCardMainLineFull(bands, info)).toBe("최저 ₩900,000~");
  });

  it("returns null when no valid numbers", () => {
    expect(getProductCardSeasonalBandInfo({ offSeason: 0, weekend: null })).toBeNull();
    expect(getProductCardSeasonalBandInfo(null)).toBeNull();
  });
});
