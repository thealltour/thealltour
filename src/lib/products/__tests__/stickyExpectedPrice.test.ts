import { describe, expect, it } from "vitest";
import {
  getSelectedDepartureStickyDateLabel,
  resolveStickyExpectedAmount,
} from "@/lib/products/stickyExpectedPrice";
import { buildProductStickyMetaLine } from "@/lib/products/productFixedDeparture";

describe("resolveStickyExpectedAmount", () => {
  it("uses departure price when it differs from product quote base", () => {
    expect(
      resolveStickyExpectedAmount({
        selectedDeparturePrice: 920_000,
        quoteTotal: 799_000,
        quoteBasePrice: 799_000,
      }),
    ).toEqual({ amount: 920_000, fromDeparture: true });
  });

  it("adds option delta on top of the selected departure price", () => {
    expect(
      resolveStickyExpectedAmount({
        selectedDeparturePrice: 920_000,
        quoteTotal: 849_000,
        quoteBasePrice: 799_000,
      }),
    ).toEqual({ amount: 970_000, fromDeparture: true });
  });

  it("falls back to quote total when no departure is selected", () => {
    expect(
      resolveStickyExpectedAmount({
        selectedDeparturePrice: null,
        quoteTotal: 799_000,
        quoteBasePrice: 799_000,
      }),
    ).toEqual({ amount: 799_000, fromDeparture: false });
  });

  it("returns null when neither departure nor quote is available", () => {
    expect(
      resolveStickyExpectedAmount({
        selectedDeparturePrice: null,
        quoteTotal: null,
        quoteBasePrice: null,
      }),
    ).toBeNull();
  });
});

describe("getSelectedDepartureStickyDateLabel", () => {
  it("formats ISO inquiry value as sticky date", () => {
    expect(
      getSelectedDepartureStickyDateLabel({
        inquiryValue: "2026-10-09",
        label: "10/9-11 출발 · 920,000원",
      }),
    ).toBe("2026.10.09(금)");
  });

  it("strips price parentheses from an ISO inquiry value", () => {
    expect(
      getSelectedDepartureStickyDateLabel({
        inquiryValue: "2026-10-09 (920,000원)",
        label: "10/9-11 출발 · 920,000원",
      }),
    ).toBe("2026.10.09(금)");
  });

  it("parses a chip label that includes a price suffix", () => {
    expect(
      getSelectedDepartureStickyDateLabel({
        inquiryValue: "10/9-11 출발 (920,000원)",
        label: "10/9-11 출발 · 920,000원",
      }),
    ).toMatch(/10/);
  });
});

describe("buildProductStickyMetaLine selected date", () => {
  const product = {
    departure_from_date: "2026-09-25",
    duration: "2박 3일",
    price_meta: "1인 기준",
  } as never;

  it("uses selected date instead of departure_from_date", () => {
    expect(
      buildProductStickyMetaLine(product, {
        selectedDateLabel: "2026.10.09(금)",
      }),
    ).toBe("2026.10.09(금) · 2박 3일 · 1인 기준");
  });

  it("falls back to departure_from_date when nothing is selected", () => {
    expect(buildProductStickyMetaLine(product)).toContain("2026.09.25");
  });
});
