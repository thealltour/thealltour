import { describe, expect, it } from "vitest";
import {
  BAND_MAX_ITINERARY_CHARS,
  truncateBandItineraryText,
  truncateBandText,
} from "@/lib/admin/bandImport/bandTextTruncate";

describe("bandTextTruncate", () => {
  it("truncateBandText cuts at max chars", () => {
    const text = "a".repeat(100);
    expect(truncateBandText(text, 50)).toHaveLength(50);
  });

  it("truncateBandItineraryText preserves itinerary section when possible", () => {
    const prefix = "x".repeat(1000);
    const itinerary = "\n\n1일차 인천 출발\n골프 라운드";
    const text = prefix + itinerary + "y".repeat(BAND_MAX_ITINERARY_CHARS);
    const result = truncateBandItineraryText(text);
    expect(result).toContain("1일차");
    expect(result.length).toBeLessThanOrEqual(BAND_MAX_ITINERARY_CHARS);
  });
});
