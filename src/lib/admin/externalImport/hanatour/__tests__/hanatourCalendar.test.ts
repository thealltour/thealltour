import { describe, expect, it } from "vitest";

import { mapHanatourCalendarToImport } from "@/lib/admin/externalImport/hanatour/mapHanatourCalendarToImport";
import { parseHanatourWonAmount, normalizeHanatourPriceText } from "@/lib/admin/externalImport/hanatour/parseHanatourWonAmount";
import { transformCalendarData } from "@/lib/admin/externalImport/hanatour/transformCalendarData";
import type { HanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";

const SAMPLE_PAYLOAD: HanatourCalendarPayload = {
  prodCode: "CGP6262609247C1",
  saleProdCd: "CGP6262609247C1",
  rprsProdCd: "MCG1059",
  searchCalendar: {
    "202609": [
      {
        depDay: "20260924",
        depDayNm: "09.24.목",
        adtAmt: "151만",
        minAmtYn: "N",
        selected: "Y",
      },
      {
        depDay: "20260927",
        depDayNm: "09.27.일",
        adtAmt: "136만",
        minAmtYn: "N",
        selected: "N",
      },
    ],
  },
  calendarData: [
    {
      saleProdCd: "CGP6262609247C1",
      rprsProdCd: "MCG1059",
      saleProdNm: "[출발확정] [대구출발] 계림직항 5일...",
      nrmlAmt: 1549900,
      adtAmt: 1519900,
      reserveStatus: "예약가능",
      depDay: "20260924",
      arrDay: "20260929",
    },
  ],
};

/** 사용자 제공 Network 응답 기반 전체 searchCalendar 샘플 */
const FULL_USER_SAMPLE: HanatourCalendarPayload = {
  prodCode: "CGP6262610047CA",
  saleProdCd: "CGP6262610047CA",
  rprsProdCd: "MCG1059",
  searchCalendar: {
    "202609": [
      { depDay: "20260924", depDayNm: "09.24.목", adtAmt: "151만" },
      { depDay: "20260927", depDayNm: "09.27.일", adtAmt: "136만" },
    ],
    "202610": [
      { depDay: "20261001", depDayNm: "10.01.목", adtAmt: "171만" },
      { depDay: "20261004", depDayNm: "10.04.일", adtAmt: "156만" },
      { depDay: "20261008", depDayNm: "10.08.목", adtAmt: "151만" },
      { depDay: "20261011", depDayNm: "10.11.일", adtAmt: "136만" },
      { depDay: "20261015", depDayNm: "10.15.목", adtAmt: "126만" },
      { depDay: "20261018", depDayNm: "10.18.일", adtAmt: "136만" },
      { depDay: "20261022", depDayNm: "10.22.목", adtAmt: "126만" },
      { depDay: "20261025", depDayNm: "10.25.일", adtAmt: "136만" },
      { depDay: "20261029", depDayNm: "10.29.목", adtAmt: "126만" },
    ],
    "202611": [
      { depDay: "20261101", depDayNm: "11.01.일", adtAmt: "139만" },
      { depDay: "20261105", depDayNm: "11.05.목", adtAmt: "129만" },
      { depDay: "20261108", depDayNm: "11.08.일", adtAmt: "139만" },
      { depDay: "20261112", depDayNm: "11.12.목", adtAmt: "129만" },
      { depDay: "20261115", depDayNm: "11.15.일", adtAmt: "139만" },
      { depDay: "20261119", depDayNm: "11.19.목", adtAmt: "129만" },
      { depDay: "20261122", depDayNm: "11.22.일", adtAmt: "139만" },
      { depDay: "20261126", depDayNm: "11.26.목", adtAmt: "129만" },
    ],
  },
  calendarData: [
    {
      saleProdCd: "CGP6262610047CA",
      rprsProdCd: "MCG1059",
      adtAmt: 1569900,
      reserveStatus: "예약가능",
      depDay: "20261004",
      arrDay: "20261009",
    },
  ],
};

describe("parseHanatourWonAmount", () => {
  it("parses 만 suffix strings", () => {
    expect(parseHanatourWonAmount("151만")).toBe(1_510_000);
    expect(parseHanatourWonAmount("136만")).toBe(1_360_000);
    expect(parseHanatourWonAmount("126만")).toBe(1_260_000);
    expect(parseHanatourWonAmount("89만원")).toBe(890_000);
  });

  it("parses prices with label prefix like 최저가", () => {
    expect(normalizeHanatourPriceText("최저가 136만")).toBe("136만");
    expect(parseHanatourWonAmount("최저가 136만")).toBe(1_360_000);
    expect(parseHanatourWonAmount("최저가 126만")).toBe(1_260_000);
  });

  it("parses numeric values", () => {
    expect(parseHanatourWonAmount(1519900)).toBe(1519900);
    expect(parseHanatourWonAmount("1519900")).toBe(1519900);
    expect(parseHanatourWonAmount("1,519,900")).toBe(1_519_900);
  });
});

describe("transformCalendarData", () => {
  it("flattens searchCalendar into departure schedules", () => {
    const schedules = transformCalendarData(
      SAMPLE_PAYLOAD.searchCalendar,
      SAMPLE_PAYLOAD.calendarData,
    );

    expect(schedules).toHaveLength(2);
    expect(schedules[0]).toEqual({
      departureDate: "2026-09-24",
      returnDate: "2026-09-29",
      price: 1519900,
      label: "09.24.목",
      status: "AVAILABLE",
    });
    expect(schedules[1]).toEqual({
      departureDate: "2026-09-27",
      returnDate: null,
      price: 1_360_000,
      label: "09.27.일",
      status: null,
    });
  });

  it("parses 최저가 prefixed adtAmt from searchCalendar", () => {
    const schedules = transformCalendarData({
      "202609": [{ depDay: "20260927", depDayNm: "09.27", adtAmt: "최저가 136만" }],
    });
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.price).toBe(1_360_000);
  });

  it("flattens full user sample with all departure dates and min price", () => {
    const schedules = transformCalendarData(
      FULL_USER_SAMPLE.searchCalendar,
      FULL_USER_SAMPLE.calendarData,
    );

    expect(schedules).toHaveLength(19);
    expect(schedules.map((s) => s.departureDate)).toContain("2026-09-24");
    expect(schedules.map((s) => s.departureDate)).toContain("2026-10-04");
    expect(schedules.map((s) => s.departureDate)).toContain("2026-11-26");

    const oct4 = schedules.find((s) => s.departureDate === "2026-10-04");
    expect(oct4).toMatchObject({
      price: 1_569_900,
      returnDate: "2026-10-09",
      status: "AVAILABLE",
    });

    const minPrice = Math.min(
      ...schedules.map((s) => s.price).filter((p): p is number => p != null),
    );
    expect(minPrice).toBe(1_260_000);
  });
});

describe("mapHanatourCalendarToImport", () => {
  it("maps payload to departure_schedules_json and min price", () => {
    const result = mapHanatourCalendarToImport(SAMPLE_PAYLOAD);

    expect(result.departureSchedules).toHaveLength(2);
    expect(result.minPrice).toBe(1_360_000);
  });

  it("maps full user sample to 19 schedules with 126만 min price", () => {
    const result = mapHanatourCalendarToImport(FULL_USER_SAMPLE);
    expect(result.departureSchedules).toHaveLength(19);
    expect(result.minPrice).toBe(1_260_000);
  });
});
