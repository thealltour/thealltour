import { describe, expect, it } from "vitest";

import {
  countSearchCalendarDays,
  domScrapedRowsToSearchCalendar,
  parseYearMonthFromTitle,
} from "@/lib/admin/externalImport/hanatour/domScrapedToSearchCalendar";

describe("parseYearMonthFromTitle", () => {
  it("parses Korean calendar title", () => {
    expect(parseYearMonthFromTitle("2026년 09월")).toBe("202609");
    expect(parseYearMonthFromTitle("2026.10")).toBe("202610");
  });
});

describe("domScrapedRowsToSearchCalendar", () => {
  it("converts DOM rows to searchCalendar format", () => {
    const searchCalendar = domScrapedRowsToSearchCalendar([
      { day: 4, priceText: "156만", yearMonth: "202610" },
      { day: 24, priceText: "151만", yearMonth: "202609" },
    ]);

    expect(searchCalendar).toEqual({
      "202610": [{ depDay: "20261004", depDayNm: "10.04", adtAmt: "156만" }],
      "202609": [{ depDay: "20260924", depDayNm: "09.24", adtAmt: "151만" }],
    });
    expect(countSearchCalendarDays(searchCalendar)).toBe(2);
  });

  it("skips invalid rows", () => {
    const searchCalendar = domScrapedRowsToSearchCalendar([
      { day: 0, priceText: "156만", yearMonth: "202610" },
      { day: 15, priceText: "-", yearMonth: "202610" },
    ]);
    expect(countSearchCalendarDays(searchCalendar)).toBe(0);
  });
});
