import { describe, expect, it } from "vitest";
import { buildCorporateQuoteHref } from "@/lib/corporate/buildCorporateQuoteHref";
import {
  getCorporateHubQuoteHref,
  getCorporateNavLeafItems,
  getCorporateSegmentQuoteHref,
} from "@/lib/corporate/content";

describe("buildCorporateQuoteHref", () => {
  it("passes source_path and quote_category", () => {
    expect(
      buildCorporateQuoteHref({
        sourcePath: "/corporate/business",
        quoteCategory: "corporate-business",
      }),
    ).toBe(
      "/quote?source_path=%2Fcorporate%2Fbusiness&quote_category=corporate-business",
    );
  });

  it("builds hub and segment quote hrefs with unified categories", () => {
    expect(getCorporateHubQuoteHref()).toContain("quote_category=corporate");
    expect(getCorporateHubQuoteHref()).toContain("source_path=%2Fcorporate");
    expect(getCorporateSegmentQuoteHref("councils")).toContain(
      "quote_category=corporate-councils",
    );
  });

  it("orders corporate nav leaves as specified", () => {
    expect(getCorporateNavLeafItems().map((item) => item.label)).toEqual([
      "기업",
      "공기업",
      "공공기관",
      "의회",
      "기업·기관 견적",
      "가족·동호회 단체 견적",
    ]);
    expect(getCorporateNavLeafItems().at(-1)?.href).toBe("/quote");
  });
});
