import { describe, expect, it } from "vitest";
import {
  buildDepartureSiblings,
  buildDepartureSwitchHref,
  parseCarriedDepartureYmd,
  parseCarriedTravelerCount,
  resolveCarriedDeparture,
} from "@/lib/products/departureSiblings";

describe("buildDepartureSiblings", () => {
  const rows = [
    {
      id: "busan",
      departure_city: "부산",
      duration: "4일",
      price: 1_500_000,
      departure_schedules_json: [
        { departureDate: "2026-10-03", price: 1_299_000, status: "SOLD_OUT" },
        { departureDate: "2026-10-05", price: 1_349_000 },
      ],
    },
    { id: "incheon", departure_city: "인천", duration: "5일", price: 1_399_000, departure_schedules_json: null },
    { id: "nameless", departure_city: "  ", duration: "5일", price: 1 },
  ];

  it("orders by city, skips rows without a city, and uses the lowest open schedule price", () => {
    const siblings = buildDepartureSiblings(rows, "busan");
    expect(siblings.map((s) => s.id)).toEqual(["incheon", "busan"]);
    expect(siblings[1]).toMatchObject({ departureCity: "부산", fromPrice: 1_349_000, isCurrent: true });
    expect(siblings[0]).toMatchObject({ duration: "5일", fromPrice: 1_399_000, isCurrent: false });
  });

  it("returns an empty list when there is no other departure or the current product is missing", () => {
    expect(buildDepartureSiblings([rows[1]], "incheon")).toEqual([]);
    expect(buildDepartureSiblings(rows, "unknown")).toEqual([]);
  });
});

describe("departure carry-over", () => {
  it("builds the switch href with date and pax", () => {
    expect(buildDepartureSwitchHref("busan", { ymd: "2026-10-03", travelerCount: 2 })).toBe(
      "/products/busan?date=2026-10-03&pax=2",
    );
    expect(buildDepartureSwitchHref("busan", { ymd: null, travelerCount: null })).toBe("/products/busan");
  });

  it("parses only well-formed query values", () => {
    expect(parseCarriedTravelerCount("3")).toBe(3);
    expect(parseCarriedTravelerCount(["4"])).toBe(4);
    expect(parseCarriedTravelerCount("abc")).toBeNull();
    expect(parseCarriedDepartureYmd("2026-10-03")).toBe("2026-10-03");
    expect(parseCarriedDepartureYmd("10/3")).toBeNull();
  });

  it("restores a date that exists and is open on the sibling", () => {
    const product = {
      departureSchedules: [
        { departureDate: "2026-10-03", price: 1_299_000 },
        { departureDate: "2026-10-04", price: 1_299_000, status: "SOLD_OUT" as const },
      ],
    };
    const restored = resolveCarriedDeparture(product, "2026-10-03");
    expect(restored?.departure).toMatchObject({ ymd: "2026-10-03", price: 1_299_000 });
    expect(resolveCarriedDeparture(product, "2026-10-04")).toBeNull();
    expect(resolveCarriedDeparture(product, "2026-10-09")).toBeNull();
  });
});
