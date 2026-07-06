import { describe, expect, it } from "vitest";

import {
  getCalendarMonthKeys,
  hasEnoughDayStripCells,
  hasMonthInCalendar,
  isProductDetailHref,
  nextYearMonth,
  shouldSkipStripPaging,
} from "@/lib/admin/externalImport/hanatour/calendarSafeNav";
import { isHanatourSearchPageUrl } from "@/lib/admin/externalImport/hanatour/resolveParentTabCandidates";

describe("calendarSafeNav", () => {
  it("isProductDetailHref rejects pkg detail links", () => {
    expect(isProductDetailHref("#none")).toBe(false);
    expect(isProductDetailHref("#")).toBe(false);
    expect(
      isProductDetailHref(
        "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CGP6262609277CA",
      ),
    ).toBe(true);
    expect(
      isProductDetailHref("/trp/pkg/CHPC0PKG0200M200?pkgCd=ABC&depDay=20260927"),
    ).toBe(true);
  });

  it("hasEnoughDayStripCells accepts 2-day late-month strips", () => {
    expect(hasEnoughDayStripCells(1)).toBe(false);
    expect(hasEnoughDayStripCells(2)).toBe(true);
    expect(hasEnoughDayStripCells(5)).toBe(true);
  });

  it("nextYearMonth advances September to October", () => {
    expect(nextYearMonth("202609")).toBe("202610");
    expect(nextYearMonth("202612")).toBe("202701");
  });

  it("hasMonthInCalendar and getCalendarMonthKeys", () => {
    const cal = {
      "202609": [{ depDay: "20260924" }, { depDay: "20260927" }],
      "202610": [{ depDay: "20261001" }],
      empty: [],
    };
    expect(hasMonthInCalendar(cal, "202609")).toBe(true);
    expect(hasMonthInCalendar(cal, "202611")).toBe(false);
    expect(getCalendarMonthKeys(cal)).toEqual(["202609", "202610"]);
  });

  it("shouldSkipStripPaging when API returned full month", () => {
    expect(shouldSkipStripPaging(4)).toBe(false);
    expect(shouldSkipStripPaging(5)).toBe(true);
    expect(shouldSkipStripPaging(9)).toBe(true);
  });
});

describe("parent tab URL filter", () => {
  it("isHanatourSearchPageUrl accepts all-search", () => {
    expect(
      isHanatourSearchPageUrl(
        "https://www.hanatour.com/all-search?keyword=대구출발&keywordCateg=DS",
      ),
    ).toBe(true);
  });

  it("isHanatourSearchPageUrl rejects product detail tabs", () => {
    expect(
      isHanatourSearchPageUrl(
        "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CGP6262609277CA&depDay=20260927",
      ),
    ).toBe(false);
  });
});
