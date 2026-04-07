import { describe, expect, it } from "vitest";
import {
  getFallbackBasePriceFromSeasonalBands,
  normalizeNullablePriceNumber,
  parseSeasonalPriceBandsFromUnknown,
  sanitizeSeasonalPriceBandsFromFormStrings,
  seasonalPriceBandsToJsonColumn,
} from "@/lib/products/seasonalPriceBands";

describe("seasonalPriceBands", () => {
  it("normalizeNullablePriceNumber rejects non-positive", () => {
    expect(normalizeNullablePriceNumber("")).toBeNull();
    expect(normalizeNullablePriceNumber("0")).toBeNull();
    expect(normalizeNullablePriceNumber("-1")).toBeNull();
    expect(normalizeNullablePriceNumber("1,234,000")).toBe(1234000);
  });

  it("sanitizeSeasonalPriceBandsFromFormStrings returns null when all empty", () => {
    expect(
      sanitizeSeasonalPriceBandsFromFormStrings({ offSeason: "", weekend: "", peakSeason: "" }),
    ).toBeNull();
  });

  it("getFallbackBasePriceFromSeasonalBands returns min of valid values", () => {
    expect(
      getFallbackBasePriceFromSeasonalBands({ offSeason: 900000, weekend: 1200000, peakSeason: 1500000 }),
    ).toBe(900000);
  });

  it("parseSeasonalPriceBandsFromUnknown accepts snake_case", () => {
    expect(parseSeasonalPriceBandsFromUnknown({ off_season: 1, weekend: 2, peak_season: 3 })).toEqual({
      offSeason: 1,
      weekend: 2,
      peakSeason: 3,
    });
  });

  it("seasonalPriceBandsToJsonColumn drops empty", () => {
    expect(seasonalPriceBandsToJsonColumn({ offSeason: 100 })).toEqual({ offSeason: 100 });
  });
});
