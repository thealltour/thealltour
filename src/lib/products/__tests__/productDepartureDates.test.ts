import { describe, expect, it } from "vitest";
import {
  collectProductDepartureDates,
  expandYmdRange,
  normalizeProductDepartureDateToYmd,
  normalizeProductDepartureDateToYmdWithForcedYear,
  parseDepartureRangeText,
  ymdDayDiff,
} from "@/lib/products/productDepartureDates";
import type { Product } from "@/types/product";

describe("normalizeProductDepartureDateToYmd", () => {
  it("accepts ISO YYYY-MM-DD", () => {
    expect(normalizeProductDepartureDateToYmd("2026-09-23")).toBe("2026-09-23");
  });

  it("parses Korean admin format YYYY.MM.DD(weekday)", () => {
    expect(normalizeProductDepartureDateToYmd("2026.02.20(금)")).toBe("2026-02-20");
  });

  it("parses dot and slash variants with single-digit month/day", () => {
    expect(normalizeProductDepartureDateToYmd("2026.2.5")).toBe("2026-02-05");
    expect(normalizeProductDepartureDateToYmd("2026/10/01")).toBe("2026-10-01");
  });

  it("parses month/day-only dates with defaultYear", () => {
    expect(normalizeProductDepartureDateToYmd("7/23(수)", { defaultYear: 2026 })).toBe("2026-07-23");
    expect(normalizeProductDepartureDateToYmd("07.23", { defaultYear: 2026 })).toBe("2026-07-23");
  });

  it("parses Korean YYYY년 M월 D일 and M월 D일 formats", () => {
    expect(normalizeProductDepartureDateToYmd("2026년 7월 23일")).toBe("2026-07-23");
    expect(normalizeProductDepartureDateToYmd("2026년 07월 23일(금)")).toBe("2026-07-23");
    expect(normalizeProductDepartureDateToYmd("7월 23일", { defaultYear: 2026 })).toBe("2026-07-23");
    expect(normalizeProductDepartureDateToYmd("07월 23일(목)", { defaultYear: 2026 })).toBe(
      "2026-07-23",
    );
  });

  it("forces default year over AI-hallucinated ISO dates", () => {
    expect(normalizeProductDepartureDateToYmdWithForcedYear("2023-07-23", 2026)).toBe(
      "2026-07-23",
    );
    expect(normalizeProductDepartureDateToYmdWithForcedYear("2023.07.23(수)", 2026)).toBe(
      "2026-07-23",
    );
    expect(normalizeProductDepartureDateToYmdWithForcedYear("7/23(수)", 2026)).toBe("2026-07-23");
    expect(normalizeProductDepartureDateToYmdWithForcedYear("7월 23일", 2026)).toBe("2026-07-23");
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeProductDepartureDateToYmd("")).toBeNull();
    expect(normalizeProductDepartureDateToYmd(null)).toBeNull();
    expect(normalizeProductDepartureDateToYmd("미정")).toBeNull();
    expect(normalizeProductDepartureDateToYmd("2026-13-40")).toBeNull();
  });
});

describe("parseDepartureRangeText", () => {
  it("parses single-field range text", () => {
    expect(parseDepartureRangeText("2026.07.01~2026.08.31")).toEqual({
      start: "2026-07-01",
      end: "2026-08-31",
    });
  });
});

describe("expandYmdRange", () => {
  it("expands inclusive date range", () => {
    const range = expandYmdRange("2026-07-01", "2026-07-03");
    expect(range).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });
});

describe("ymdDayDiff", () => {
  it("returns 1 for consecutive flight departure and arrival", () => {
    expect(ymdDayDiff("2026-08-13", "2026-08-14")).toBe(1);
  });
});

describe("collectProductDepartureDates", () => {
  it("returns only departure date for overnight flight (from + to within 1 day)", () => {
    const product = {
      id: "p-flight",
      title: "야간 항공 골프",
      departure_from_date: "2026-08-13",
      departure_to_date: "2026-08-14",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-08-13"]);
  });

  it("returns only departure date for Korean admin flight date formats", () => {
    const product = {
      id: "p-flight-ko",
      title: "한국어 형식 항공",
      departure_from_date: "2026.08.13(수)",
      departure_to_date: "2026.08.14(목)",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-08-13"]);
  });

  it("returns only departure date when from/to span trip duration without tilde range", () => {
    const product = {
      id: "p-trip",
      title: "패키지 여행",
      departure_from_date: "2026-10-04",
      departure_to_date: "2026-10-09",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-10-04"]);
  });

  it("expands explicit tilde range on departure_from_date", () => {
    const product = {
      id: "p-inline",
      title: "인라인 범위",
      departure_from_date: "2026.07.01~2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
  });

  it("prefers departure schedules over flight from/to date range", () => {
    const product = {
      id: "p-schedules-win",
      title: "하나투어 패키지",
      departureSchedules: [
        { departureDate: "2026-09-24", returnDate: null, price: 1510000 },
        { departureDate: "2026-09-27", returnDate: null, price: 1360000 },
      ],
      departure_from_date: "2026-10-04",
      departure_to_date: "2026-10-09",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-09-24", "2026-09-27"]);
  });

  it("expands departure_from_date and departure_to_date when both are separate range endpoints", () => {
    const product = {
      id: "p-range",
      title: "여름 골프",
      departure_from_date: "2026.07.01~2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[dates.length - 1]).toBe("2026-08-31");
  });

  it("expands single-field range string", () => {
    const product = {
      id: "p-inline",
      title: "인라인 범위",
      departure_from_date: "2026.07.01~2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
  });

  it("returns one date when from and to are equal", () => {
    const product = {
      id: "p-single",
      title: "단일일",
      departure_from_date: "2026-09-23",
      departure_to_date: "2026-09-23",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-09-23"]);
  });

  it("ignores returnDate on departure schedules (calendar shows departure only)", () => {
    const product = {
      id: "p-schedule",
      title: "스케줄 골프",
      departureSchedules: [
        { departureDate: "2026-07-23", returnDate: "2026-07-26", price: 899000 },
      ],
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-07-23"]);
  });

  it("falls back to departure_from_date when schedules contain unparseable placeholder", () => {
    const product = {
      id: "p-placeholder",
      title: "레거시 골프",
      departureSchedules: [{ departureDate: "미정", returnDate: null, price: null }],
      departure_from_date: "2026-09-15",
      departure_to_date: "2026-09-20",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-09-15"]);
  });

  it("falls back to departure_from_date when schedules array exists but yields zero parseable dates", () => {
    const product = {
      id: "p-empty-schedules",
      title: "추후 안내 골프",
      departureSchedules: [
        { departureDate: "추후 안내", returnDate: null, price: null },
        { departureDate: "미정", returnDate: null, price: null },
      ],
      departure_from_date: "2026.07.01~2026.08.31",
    } as Product;

    const dates = collectProductDepartureDates(product);
    expect(dates).toHaveLength(62);
    expect(dates[0]).toBe("2026-07-01");
  });

  it("expands from/to window when expandDepartureWindow is true", () => {
    const product = {
      id: "p-window",
      title: "출발 가능 기간",
      departure_from_date: "2026-07-01",
      departure_to_date: "2026-08-31",
    } as Product;

    const dates = collectProductDepartureDates(product, { expandDepartureWindow: true });
    expect(dates).toHaveLength(62);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[dates.length - 1]).toBe("2026-08-31");
  });

  it("does not expand from/to window by default (product detail UX)", () => {
    const product = {
      id: "p-window-default",
      title: "패키지 여행",
      departure_from_date: "2026-07-01",
      departure_to_date: "2026-08-31",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-07-01"]);
  });

  it("ignores from/to when valid schedule dates exist", () => {
    const product = {
      id: "p-valid-schedules",
      title: "하나투어 패키지",
      departureSchedules: [
        { departureDate: "2026-09-24", returnDate: null, price: 1510000 },
        { departureDate: "미정", returnDate: null, price: null },
      ],
      departure_from_date: "2026-10-04",
      departure_to_date: "2026-10-09",
    } as Product;

    expect(collectProductDepartureDates(product)).toEqual(["2026-09-24"]);
  });
});
