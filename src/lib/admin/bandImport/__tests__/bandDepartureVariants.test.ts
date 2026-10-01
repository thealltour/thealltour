import { describe, expect, it } from "vitest";
import {
  appendDepartureToTitle,
  departureCityFromAirport,
  guessDepartureCityFromFilename,
  normalizeDepartureCity,
  resolveDepartureCity,
} from "@/lib/admin/bandImport/bandDepartureVariants";

describe("bandDepartureVariants", () => {
  it("guesses departure city from HWP filename", () => {
    expect(guessDepartureCityFromFilename("1125 알라방3색[54홀]4일 석석 부산출발 PR.hwp")).toBe("부산");
    expect(guessDepartureCityFromFilename("사이판 인천 출발.hwpx")).toBe("인천");
    expect(guessDepartureCityFromFilename("김해출발 특가.hwp")).toBe("부산");
    expect(guessDepartureCityFromFilename("1125 알라방3색[54홀]5일 석석 OZ 1399.hwp")).toBeNull();
  });

  it("maps airport text and codes to a city", () => {
    expect(departureCityFromAirport("인천 국제공항")).toBe("인천");
    expect(departureCityFromAirport("김해국제공항")).toBe("부산");
    expect(departureCityFromAirport("PUS")).toBe("부산");
    expect(departureCityFromAirport("Manila (MNL)")).toBeNull();
    expect(departureCityFromAirport(null)).toBeNull();
  });

  it("normalizes admin input", () => {
    expect(normalizeDepartureCity(" 부산출발 ")).toBe("부산");
    expect(normalizeDepartureCity("김해")).toBe("부산");
    expect(normalizeDepartureCity("울산")).toBe("울산");
    expect(normalizeDepartureCity("  ")).toBeNull();
  });

  it("resolves explicit input first, then filename, then airport", () => {
    expect(resolveDepartureCity({ explicit: "대구", filename: "부산출발.hwp", airport: "인천" })).toBe("대구");
    expect(resolveDepartureCity({ filename: "부산출발.hwp", airport: "인천" })).toBe("부산");
    expect(resolveDepartureCity({ filename: "no-city.hwp", airport: "인천 국제공항" })).toBe("인천");
    expect(resolveDepartureCity({})).toBeNull();
  });

  it("appends the departure label only when missing from the title", () => {
    expect(appendDepartureToTitle("알라방3색 54홀 5일", "인천")).toBe("알라방3색 54홀 5일 (인천출발)");
    expect(appendDepartureToTitle("알라방3색 54홀 4일 부산출발", "부산")).toBe("알라방3색 54홀 4일 부산출발");
    expect(appendDepartureToTitle("알라방3색", null)).toBe("알라방3색");
  });
});
