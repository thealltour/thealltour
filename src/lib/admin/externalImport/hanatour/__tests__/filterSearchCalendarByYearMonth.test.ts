import { describe, expect, it } from "vitest";

import {
  filterSearchCalendarByYearMonth,
  findVisibleYearMonthInDocumentText,
  parseVisibleYearMonth,
} from "@/lib/admin/externalImport/hanatour/filterSearchCalendarByYearMonth";

describe("parseVisibleYearMonth", () => {
  it("parses Korean year-month header", () => {
    expect(parseVisibleYearMonth("2026년 09월")).toBe("202609");
    expect(parseVisibleYearMonth("< 2026년 09월 >")).toBe("202609");
  });
});

describe("findVisibleYearMonthInDocumentText", () => {
  it("finds year-month in longer text", () => {
    expect(findVisibleYearMonthInDocumentText("출발일 선택 < 2026년 09월 >")).toBe("202609");
  });
});

describe("filterSearchCalendarByYearMonth", () => {
  const mixed = {
    "202607": [{ depDay: "20260701", adtAmt: "139만" }],
    "202609": [
      { depDay: "20260924", adtAmt: "151만" },
      { depDay: "20260927", adtAmt: "136만" },
    ],
  };

  it("keeps only the anchor month bucket", () => {
    const filtered = filterSearchCalendarByYearMonth(mixed, "202609");
    expect(filtered).toEqual({
      "202609": [
        { depDay: "20260924", adtAmt: "151만" },
        { depDay: "20260927", adtAmt: "136만" },
      ],
    });
  });

  it("returns null when anchor month is missing", () => {
    expect(filterSearchCalendarByYearMonth(mixed, "202610")).toBeNull();
  });
});
