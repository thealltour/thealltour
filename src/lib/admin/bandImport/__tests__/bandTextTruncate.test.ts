import { describe, expect, it } from "vitest";
import {
  BAND_MAX_ITINERARY_CHARS,
  BAND_MAX_META_CHARS,
  BAND_META_BAND_RESERVE_CHARS,
  BAND_SOURCE_BAND_HEADER,
  BAND_SOURCE_HWP_HEADER,
  buildBandItinerarySourceText,
  buildBandMetaSourceText,
  truncateBandItineraryText,
  truncateBandText,
} from "@/lib/admin/bandImport/bandTextTruncate";

describe("bandTextTruncate", () => {
  it("truncateBandText cuts at max chars", () => {
    const text = "a".repeat(100);
    expect(truncateBandText(text, 50)).toHaveLength(50);
  });

  it("keeps the band marketing copy in meta source even when HWP is huge", () => {
    const hwp = "H".repeat(BAND_MAX_META_CHARS * 2);
    const band = "특가 홍보 문단 " + "B".repeat(3000);
    const source = buildBandMetaSourceText(hwp, band);
    expect(source.length).toBeLessThanOrEqual(BAND_MAX_META_CHARS);
    expect(source.startsWith(BAND_SOURCE_BAND_HEADER)).toBe(true);
    expect(source).toContain(band);
    expect(source).toContain(BAND_SOURCE_HWP_HEADER);
  });

  it("caps the band share of meta source at the reserve when HWP is long", () => {
    const hwp = "H".repeat(BAND_MAX_META_CHARS);
    const band = "B".repeat(BAND_META_BAND_RESERVE_CHARS * 2);
    const source = buildBandMetaSourceText(hwp, band);
    const bandSection = source.split(BAND_SOURCE_HWP_HEADER)[0];
    expect(bandSection.match(/B/g)?.length).toBe(BAND_META_BAND_RESERVE_CHARS);
    expect(source.length).toBeLessThanOrEqual(BAND_MAX_META_CHARS);
  });

  it("uses only the available text when one source is empty", () => {
    expect(buildBandMetaSourceText("", "밴드만")).toBe("밴드만");
    expect(buildBandItinerarySourceText("HWP만", "")).toBe("HWP만");
  });

  it("includes band text after HWP in the itinerary source", () => {
    const source = buildBandItinerarySourceText("1일차 인천 출발", "3일차 추가 관광");
    expect(source.indexOf(BAND_SOURCE_HWP_HEADER)).toBeLessThan(source.indexOf(BAND_SOURCE_BAND_HEADER));
    expect(source).toContain("3일차 추가 관광");
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
