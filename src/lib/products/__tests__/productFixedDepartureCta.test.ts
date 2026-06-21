import { describe, expect, it } from "vitest";
import { getProductCtaLabel, getProductCtaStickyPrimaryLabel } from "@/lib/products/getProductCtaLabel";
import {
  getProductFixedDepartureDateLabel,
  hasProductFixedDeparture,
} from "@/lib/products/productFixedDeparture";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

describe("getProductCtaLabel fixed departure", () => {
  it("uses 빠른 문의 for AVAILABLE fixed-date products", () => {
    expect(getProductCtaLabel("AVAILABLE", { fixedDeparture: true })).toBe("빠른 문의");
    expect(getProductCtaStickyPrimaryLabel("AVAILABLE", { fixedDeparture: true })).toBe("빠른 문의");
  });

  it("keeps default label without fixed departure", () => {
    expect(getProductCtaLabel("AVAILABLE")).toBe("출발일별 정확한 요금 문의");
  });
});

describe("productFixedDeparture", () => {
  it("detects departure_from_date", () => {
    expect(hasProductFixedDeparture({ departure_from_date: "2026-09-23" } as never)).toBe(true);
    expect(getProductFixedDepartureDateLabel({
      departure_from_date: "2026-09-23",
      departure_to_date: "2026-09-26",
    } as never)).toContain("2026.09.23");
  });
});

describe("resolveAirlineLogoUrls", () => {
  it("resolves self-hosted and data-uri fallback for HU450", () => {
    const urls = resolveAirlineLogoUrls("HU450");
    expect(urls.some((u) => u.includes("/HU.svg"))).toBe(true);
    expect(urls.some((u) => u.startsWith("data:image/svg+xml,"))).toBe(true);
    expect(urls.some((u) => u.includes("kiwi.com"))).toBe(false);
  });
});
