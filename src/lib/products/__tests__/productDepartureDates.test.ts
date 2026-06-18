import { describe, expect, it } from "vitest";
import {
  collectProductDepartureDates,
  expandYmdRange,
  normalizeProductDepartureDateToYmd,
  parseDepartureRangeText,
} from "@/lib/products/productDepartureDates";
import type { Product } from "@/types/product";

describe("normalizeProductDepartureDateToYmd", () => {
  it("accepts ISO YYYY-MM-DD", () => {
    expect(normalizeProductDepartureDateToYmd("2026-09-23")).toBe("2026-09-23");
  });

  it("parses Korean admin format YYYY.MM.DD(weekday)", () => {
    expect(normalizeProductDepartureDateToYmd("2026.02.20(금)")).toBe("2026-02-20");
  });

  it("parses dot and slash variants with single-digit month/day", () => {
    expect(normalizeProductDepartureDateToYmd("2026.2.5")).toBe("2026-02-05");
    expect(normalizeProductDepartureDateToYmd("2026/10/01")).toBe("2026-10-01");
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeProductDepartureDateToYmd("")).toBeNull();
    expect(normalizeProductDepartureDateToYmd(null)).toBeNull();
    expect(normalizeProductDepartureDateToYmd("미정")).toBeNull();
    expect(normalizeProductDepartureDateToYmd("2026-13-40")).toBeNull();
  });
});

describe("parseDepartureRangeText", () => {
  it("parses single-field range text", () => {
    expect(parseDepartureRangeText("2026.07.01~2026.08.31")).toEqual({
      start: "2026-07-01",
      end: "2026-08-31",
    });
  });
});

describe("expandYmdRange", () => {
  it("expands inclusive date range", () => {
    const range = expandYmdRange("2026-07-01", "2026-07-03");
    expect(range).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });
});

describe("collectProductDepartureDates", () => {
  it("expands departure_from_date and departure_to_date", () => {
    const product = {
      id: "p-range",
      title: "여름 골프",
      departure_from_date: "2026.07.01",
      departure_to_date: "2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[dates.length - 1]).toBe("2026-08-31");
  });

  it("expands single-field range string", () => {
    const product = {
      id: "p-inline",
      title: "인라인 범위",
      departure_from_date: "2026.07.01~2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
  });

  it("returns one date when from and to are equal", () => {
    const product = {
      id: "p-single",
      title: "단일일",
      departure_from_date: "2026-09-23",
      departure_to_date: "2026-09-23",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-09-23"]);
  });
});
