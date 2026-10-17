import { describe, expect, it } from "vitest";
import {
  buildKlookWidgetSrc,
  buildTiqetsWidgetSrc,
  isTpWidgetSrc,
  TIQETS_WIDGET_MAX_PRODUCTS,
} from "@/lib/affiliate/planner/discovery/tpWidgetSrc";
import {
  TRAVELPAYOUTS_PUBLIC_SHMARKER,
  TRAVELPAYOUTS_PUBLIC_TRS,
  TRAVELPAYOUTS_SCRIPT_SRC,
} from "@/lib/affiliate/travelPayoutsConfig";

function query(src: string | null): Record<string, string> {
  expect(src).not.toBeNull();
  const url = new URL(src!);
  expect(`${url.origin}${url.pathname}`).toBe("https://tpwdgt.com/content");
  return Object.fromEntries(url.searchParams);
}

describe("PR-9AN Tiqets widget src", () => {
  it("matches the dashboard embed (2 products, backend order kept)", () => {
    const src = buildTiqetsWidgetSrc({ productIds: ["1102887", "1108257"] });
    expect(query(src)).toEqual({
      currency: "USD",
      trs: TRAVELPAYOUTS_PUBLIC_TRS,
      shmarker: TRAVELPAYOUTS_PUBLIC_SHMARKER,
      product: "1102887,1108257",
      language: "en",
      layout: "horizontal",
      powered_by: "true",
      campaign_id: "89",
      promo_id: "3948",
    });
    expect(src).toContain("product=1102887%2C1108257");
    expect(src).toBe(
      "https://tpwdgt.com/content?currency=USD&trs=570610&shmarker=774063&product=1102887%2C1108257&language=en&layout=horizontal&powered_by=true&campaign_id=89&promo_id=3948",
    );
    expect(query(buildTiqetsWidgetSrc({ productIds: ["1108257", "1102887"] })).product).toBe(
      "1108257,1102887",
    );
  });

  it("non-numeric or URL-like product id → null", () => {
    for (const bad of ["abc", "1102887&promo_id=1", "https://evil.example", "0123", "", " 1102887"]) {
      expect(buildTiqetsWidgetSrc({ productIds: ["1108257", bad] })).toBeNull();
    }
  });

  it("empty → null", () => {
    expect(buildTiqetsWidgetSrc({ productIds: [] })).toBeNull();
  });

  it("duplicates removed; more than 3 → first 3 in backend order", () => {
    expect(query(buildTiqetsWidgetSrc({ productIds: ["1", "1", "2"] })).product).toBe("1,2");
    expect(TIQETS_WIDGET_MAX_PRODUCTS).toBe(3);
    expect(query(buildTiqetsWidgetSrc({ productIds: ["4", "3", "2", "1"] })).product).toBe("4,3,2");
  });
});

describe("PR-9AN Klook widget src", () => {
  it("Osaka city 29 / category 2 matches the dashboard embed", () => {
    const src = buildKlookWidgetSrc({ cityId: "29", categoryId: "2" });
    expect(query(src)).toEqual({
      currency: "KRW",
      trs: TRAVELPAYOUTS_PUBLIC_TRS,
      shmarker: TRAVELPAYOUTS_PUBLIC_SHMARKER,
      locale: "ko_KR",
      city_id: "29",
      category: "2",
      amount: "3",
      powered_by: "true",
      campaign_id: "137",
      promo_id: "4497",
    });
    expect(src).toBe(
      "https://tpwdgt.com/content?currency=KRW&trs=570610&shmarker=774063&locale=ko_KR&city_id=29&category=2&amount=3&powered_by=true&campaign_id=137&promo_id=4497",
    );
  });

  it("invalid or missing city/category → null", () => {
    expect(buildKlookWidgetSrc({ cityId: "29", categoryId: null })).toBeNull();
    expect(buildKlookWidgetSrc({ cityId: null, categoryId: "2" })).toBeNull();
    expect(buildKlookWidgetSrc({ cityId: "osaka", categoryId: "2" })).toBeNull();
    expect(buildKlookWidgetSrc({ cityId: "29", categoryId: "2&x=1" })).toBeNull();
  });
});

describe("PR-9AN widget src guard + public attribution SSOT", () => {
  it("only tpwdgt.com/content passes the guard", () => {
    expect(isTpWidgetSrc(buildKlookWidgetSrc({ cityId: "29", categoryId: "2" })!)).toBe(true);
    expect(isTpWidgetSrc("https://evil.example/content?promo_id=4497")).toBe(false);
    expect(isTpWidgetSrc("https://tpwdgt.com/other.js")).toBe(false);
    expect(isTpWidgetSrc("http://tpwdgt.com/content")).toBe(false);
    expect(isTpWidgetSrc("javascript:alert(1)")).toBe(false);
    expect(isTpWidgetSrc("not a url")).toBe(false);
  });

  it("Drive script URL is unchanged", () => {
    expect(TRAVELPAYOUTS_SCRIPT_SRC).toBe("https://emrldtp.com/NTcwNjEw.js?t=570610");
  });
});
