import { describe, expect, it } from "vitest";
import { normalizeProduct } from "@/lib/products";
import {
  deriveDeparturesFromSchedules,
  formatDepartureScheduleChipLabel,
  formatDepartureScheduleInquiryValue,
  getDepartureSchedulesMinPrice,
  normalizeDepartureSchedulesFromUnknown,
} from "@/lib/products/normalizeDepartureSchedules";

describe("normalizeDepartureSchedulesFromUnknown", () => {
  it("parses camelCase and snake_case schedule rows", () => {
    const schedules = normalizeDepartureSchedulesFromUnknown([
      {
        departure_date: "2025.07.23(수)",
        return_date: "2025-07-26",
        price: 890000,
        label: "7/23(수) 출발",
        status: "AVAILABLE",
      },
      {
        departureDate: "2025-07-30",
        price: 920000,
      },
    ]);

    expect(schedules).toHaveLength(2);
    expect(schedules?.[0]).toMatchObject({
      departureDate: "2025-07-23",
      returnDate: "2025-07-26",
      price: 890000,
      label: "7/23(수) 출발",
      status: "AVAILABLE",
    });
    expect(schedules?.[1]?.departureDate).toBe("2025-07-30");
    expect(schedules?.[1]?.price).toBe(920000);
  });
});

describe("deriveDeparturesFromSchedules", () => {
  it("derives date labels without prices", () => {
    const departures = deriveDeparturesFromSchedules([
      { departureDate: "2025-07-23", label: "7/23(수)", price: 890000 },
      { departureDate: "2025-07-30", price: 920000 },
    ]);
    expect(departures).toEqual(["7/23(수)", "2025-07-30"]);
  });
});

describe("formatDepartureScheduleChipLabel", () => {
  it("renders date and price label", () => {
    expect(
      formatDepartureScheduleChipLabel({
        departureDate: "2025-07-23",
        label: "7/23(수)",
        price: 890000,
      }),
    ).toBe("7/23(수) · 890,000원");
  });
});

describe("formatDepartureScheduleInquiryValue", () => {
  it("prefers normalized ISO departureDate over display label", () => {
    expect(
      formatDepartureScheduleInquiryValue({
        departureDate: "2026-09-23",
        label: "09.23",
        price: 4_499_000,
      }),
    ).toBe("2026-09-23 (4,499,000원)");
  });
});

describe("getDepartureSchedulesMinPrice", () => {
  it("returns lowest schedule price", () => {
    expect(
      getDepartureSchedulesMinPrice([
        { departureDate: "2025-07-23", price: 920000 },
        { departureDate: "2025-07-30", price: 890000 },
      ]),
    ).toBe(890000);
  });
});

describe("normalizeProduct departure schedules", () => {
  it("maps departure_schedules_json to departureSchedules and departures", () => {
    const product = normalizeProduct({
      id: "p1",
      title: "테스트",
      description: "설명",
      image_url: "https://example.com/a.jpg",
      category: "여행상품",
      departure_schedules_json: [
        { departureDate: "2025-07-23", price: 890000, label: "7/23(수)" },
        { departureDate: "2025-07-30", price: 920000 },
      ],
    });

    expect(product.departureSchedules).toHaveLength(2);
    expect(product.departures).toEqual(["7/23(수)", "2025-07-30"]);
  });
});
