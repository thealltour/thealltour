import { describe, expect, it } from "vitest";

import {
  buildMonthApiUrls,
  buildYearMonthList,
  countCalendarDays,
  countCalendarMonths,
  formatDepartureScheduleAlert,
  isCalendarSufficient,
  mergeHanatourCalendarPayloads,
  mergeSearchCalendar,
} from "@/lib/admin/externalImport/hanatour/fetchCalendarViaApi";
import { normalizeParentCalendarPayload } from "@/lib/admin/externalImport/hanatour/normalizeParentCalendarPayload";
import type { HanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";

describe("buildYearMonthList", () => {
  it("builds consecutive year-month strings from a start date", () => {
    expect(buildYearMonthList(3, new Date(2026, 8, 1))).toEqual(["202609", "202610", "202611"]);
  });
});

describe("buildMonthApiUrls", () => {
  it("prefers rprsProdCd then saleProdCd URL variants", () => {
    const urls = buildMonthApiUrls(
      { rprsProdCd: "MCG1059", saleProdCd: "CGP6262609247C1" },
      "202610",
    );
    expect(urls.map((u) => u.codeType)).toEqual([
      "rprsProdCd",
      "prodCode_rprs",
      "saleProdCd",
      "prodCode_sale",
    ]);
    expect(urls[0].url).toContain("rprsProdCd=MCG1059");
    expect(urls[0].url).toContain("yearMonth=202610");
    expect(urls[2].url).toContain("saleProdCd=CGP6262609247C1");
  });

  it("returns empty list when no product codes", () => {
    expect(buildMonthApiUrls({}, "202610")).toEqual([]);
  });
});

describe("isCalendarSufficient", () => {
  const twoMonthPayload: HanatourCalendarPayload = {
    searchCalendar: {
      "202609": [{ depDay: "20260924", adtAmt: "151만" }],
      "202610": [{ depDay: "20261001", adtAmt: "171만" }],
    },
  };

  it("is sufficient with 2 or more months", () => {
    expect(isCalendarSufficient(twoMonthPayload)).toBe(true);
  });

  it("is sufficient with 5 or more days in one month", () => {
    const days = Array.from({ length: 5 }, (_, i) => ({
      depDay: `2026100${i + 1}`,
      adtAmt: "126만",
    }));
    expect(isCalendarSufficient({ searchCalendar: { "202610": days } })).toBe(true);
  });

  it("is insufficient with only 2 days in one month", () => {
    expect(
      isCalendarSufficient({
        searchCalendar: {
          "202609": [
            { depDay: "20260924", adtAmt: "151만" },
            { depDay: "20260927", adtAmt: "136만" },
          ],
        },
      }),
    ).toBe(false);
  });
});

describe("mergeHanatourCalendarPayloads", () => {
  it("merges searchCalendar months and dedupes calendarData by depDay", () => {
    const a: HanatourCalendarPayload = {
      rprsProdCd: "MCG1059",
      searchCalendar: {
        "202609": [{ depDay: "20260924", adtAmt: "151만" }],
      },
      calendarData: [{ depDay: "20260924", adtAmt: 1519900 }],
    };
    const b: HanatourCalendarPayload = {
      searchCalendar: {
        "202610": [{ depDay: "20261004", adtAmt: "156만" }],
      },
      calendarData: [
        { depDay: "20260924", adtAmt: 1519900 },
        { depDay: "20261004", adtAmt: 1569900 },
      ],
    };

    const merged = mergeHanatourCalendarPayloads(a, b);
    expect(countCalendarMonths(merged?.searchCalendar)).toBe(2);
    expect(countCalendarDays(merged?.searchCalendar)).toBe(2);
    expect(merged?.calendarData).toHaveLength(2);
    expect(merged?.rprsProdCd).toBe("MCG1059");
  });

  it("returns null when both payloads are empty", () => {
    expect(mergeHanatourCalendarPayloads(null, null)).toBeNull();
    expect(mergeHanatourCalendarPayloads({}, {})).toBeNull();
  });
});

describe("normalizeParentCalendarPayload", () => {
  it("wraps parent searchCalendar with product codes", () => {
    const payload = normalizeParentCalendarPayload(
      {
        "202610": [{ depDay: "20261004", adtAmt: "156만" }],
      },
      { saleProdCd: "CGP6262610047CA", rprsProdCd: "MCG1059", depDay: "20261004" },
    );
    expect(payload?.rprsProdCd).toBe("MCG1059");
    expect(payload?.searchCalendar?.["202610"]).toHaveLength(1);
    expect(payload?.fetchMeta?.[0]?.source).toBe("parent_tab");
  });

  it("returns null for empty calendar", () => {
    expect(normalizeParentCalendarPayload({})).toBeNull();
  });
});

describe("mergeSearchCalendar", () => {
  it("overwrites month buckets with non-empty source rows", () => {
    const target = { "202609": [{ depDay: "20260924", adtAmt: "151만" }] };
    mergeSearchCalendar(target, {
      "202610": [{ depDay: "20261004", adtAmt: "156만" }],
    });
    expect(Object.keys(target)).toEqual(["202609", "202610"]);
  });
});

describe("formatDepartureScheduleAlert", () => {
  it("shows count when schedules exist", () => {
    expect(formatDepartureScheduleAlert({ departureScheduleCount: 12 })).toBe("출발일: 12건");
  });

  it("shows API payload without parsed schedules message", () => {
    expect(
      formatDepartureScheduleAlert({
        departureScheduleCount: 0,
        hanatourCalendarPayload: { searchCalendar: { "202610": [{ depDay: "20261004" }] } },
      }),
    ).toBe("출발일: API 응답은 있으나 파싱 결과 0건");
  });

  it("shows API miss message when no payload", () => {
    expect(formatDepartureScheduleAlert({ departureScheduleCount: 0 })).toBe(
      "출발일: API 미응답 (상품은 저장됨)",
    );
  });
});
