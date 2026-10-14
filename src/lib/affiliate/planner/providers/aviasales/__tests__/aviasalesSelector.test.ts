import { describe, expect, it } from "vitest";
import {
  aviasalesPassengerSuffix,
  buildAviasalesCanonicalSearchUrl,
  buildAviasalesSearchUrl,
  selectAviasalesPriceOffer,
  toAviasalesDayMonth,
  type AviasalesCanonicalSearchInput,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesSelector";
import type { AviasalesPriceOffer } from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";

function offer(partial: Partial<AviasalesPriceOffer> & { price: number; link: string }): AviasalesPriceOffer {
  return {
    origin: "ICN",
    destination: "OSA",
    originAirport: "ICN",
    destinationAirport: "KIX",
    airline: "KE",
    flightNumber: "1",
    departureAt: "2026-10-01T00:00:00Z",
    returnAt: null,
    transfers: 0,
    ...partial,
  };
}

describe("aviasalesSelector", () => {
  it("builds aviasales.com search URL from relative link with KR presentation", () => {
    const url = buildAviasalesSearchUrl("/search/ICN0110OSA1?t=abc&expected_price_currency=usd");
    expect(url).toContain("https://www.aviasales.com/search/ICN0110OSA1");
    expect(url).toContain("t=abc");
    expect(url).toContain("locale=ko");
    expect(url).toContain("currency=krw");
    expect(url).toContain("market=kr");
    expect(url).toContain("expected_price_currency=krw");
    expect(url).not.toContain("expected_price_currency=usd");
    expect(buildAviasalesSearchUrl("https://evil.com/x")).toBeNull();
    expect(buildAviasalesSearchUrl("//evil.com/search/x")).toBeNull();
  });

  it("selects lowest price with usable link", () => {
    const selection = selectAviasalesPriceOffer({
      offers: [
        offer({ price: 300, link: "/search/expensive", transfers: 0 }),
        offer({ price: 200, link: "/search/cheap", transfers: 1 }),
        offer({ price: 150, link: "not-a-path", transfers: 0 }),
      ],
    });
    expect(selection?.offer.price).toBe(200);
    expect(selection?.sourceUrl).toContain("www.aviasales.com/search/cheap");
  });

  it("returns null when no usable commerce link", () => {
    expect(
      selectAviasalesPriceOffer({
        offers: [offer({ price: 100, link: "/book/ticket" })],
      }),
    ).toBeNull();
  });
});

function seoulOsaka(overrides?: Partial<AviasalesCanonicalSearchInput>): AviasalesCanonicalSearchInput {
  return {
    originIata: "SEL",
    destinationIata: "OSA",
    departureDate: "2027-01-28",
    returnDate: "2027-02-01",
    adults: 3,
    children: 0,
    ...overrides,
  };
}

function canonical(overrides?: Partial<AviasalesCanonicalSearchInput>): URL {
  const result = buildAviasalesCanonicalSearchUrl(seoulOsaka(overrides));
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return new URL(result.url);
}

describe("buildAviasalesCanonicalSearchUrl", () => {
  it("production regression: 서울→오사카 2027-01-28→02-01, 3 adults → SEL2801OSA01023", () => {
    const result = buildAviasalesCanonicalSearchUrl(seoulOsaka());
    expect(result).toEqual({
      ok: true,
      url: "https://www.aviasales.com/search/SEL2801OSA01023?locale=ko&currency=krw&market=kr",
    });
  });

  it("2 adults + 1 child → suffix 21", () => {
    expect(canonical({ adults: 2, children: 1 }).pathname).toBe("/search/SEL2801OSA010221");
  });

  it("1 adult → suffix 1 (previous single-passenger behavior)", () => {
    expect(canonical({ adults: 1 }).pathname).toBe("/search/SEL2801OSA01021");
  });

  it("one-way (no return date) → origin+date+destination+passengers", () => {
    expect(canonical({ returnDate: null }).pathname).toBe("/search/SEL2801OSA3");
  });

  it("economy default: no cabin letter and no infant digit", () => {
    const code = canonical({ adults: 2, children: 1 }).pathname.replace("/search/", "");
    expect(code).not.toMatch(/[cwf]\d+$/);
    expect(code.endsWith("21")).toBe(true);
  });

  it("supports 9 adults / 9 children without clamping", () => {
    expect(canonical({ adults: 9 }).pathname).toBe("/search/SEL2801OSA01029");
    expect(canonical({ adults: 1, children: 9 }).pathname).toBe("/search/SEL2801OSA010219");
  });

  it.each([
    [{ adults: 10 }],
    [{ children: 10 }],
    [{ adults: 0 }],
    [{ adults: 2.5 }],
    [{ children: -1 }],
  ])("unsupported travelers %j → rejected, never clamped", (travelers) => {
    expect(buildAviasalesCanonicalSearchUrl(seoulOsaka(travelers))).toEqual({
      ok: false,
      reason: "unsupported_travelers",
    });
  });

  it.each([
    [{ departureDate: "2027/01/28" }],
    [{ departureDate: "2027-02-30" }],
    [{ returnDate: "2027-13-01" }],
    [{ departureDate: "2027-02-02", returnDate: "2027-02-01" }],
  ])("invalid dates %j → invalid_dates", (dates) => {
    expect(buildAviasalesCanonicalSearchUrl(seoulOsaka(dates))).toEqual({
      ok: false,
      reason: "invalid_dates",
    });
  });

  it.each([[{ originIata: "SE" }], [{ destinationIata: "OS1" }], [{ originIata: "S/L" }]])(
    "invalid IATA %j → invalid_iata",
    (iata) => {
      expect(buildAviasalesCanonicalSearchUrl(seoulOsaka(iata))).toEqual({
        ok: false,
        reason: "invalid_iata",
      });
    },
  );

  it("normalizes IATA case and only carries KR presentation query", () => {
    const url = canonical({ originIata: " sel ", destinationIata: "osa" });
    expect(url.pathname).toBe("/search/SEL2801OSA01023");
    expect([...url.searchParams.keys()]).toEqual(["locale", "currency", "market"]);
  });
});

describe("aviasales passenger/date helpers", () => {
  it("passenger suffix", () => {
    expect(aviasalesPassengerSuffix({ adults: 3, children: 0 })).toBe("3");
    expect(aviasalesPassengerSuffix({ adults: 2, children: 1 })).toBe("21");
    expect(aviasalesPassengerSuffix({ adults: 10, children: 0 })).toBeNull();
    expect(aviasalesPassengerSuffix({ adults: 1, children: 10 })).toBeNull();
  });

  it("YYYY-MM-DD → DDMM without timezone shift", () => {
    expect(toAviasalesDayMonth("2027-01-28")).toBe("2801");
    expect(toAviasalesDayMonth("2027-02-01")).toBe("0102");
    expect(toAviasalesDayMonth("2028-02-29")).toBe("2902");
    expect(toAviasalesDayMonth("2027-02-29")).toBeNull();
    expect(toAviasalesDayMonth("2027-12-31")).toBe("3112");
  });
});
