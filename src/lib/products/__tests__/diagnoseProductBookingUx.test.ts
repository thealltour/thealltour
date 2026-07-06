import { describe, expect, it } from "vitest";
import { diagnoseProductBookingUx } from "@/lib/products/diagnoseProductBookingUx";
import type { Product } from "@/types/product";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return { id: "p1", title: "테스트", ...overrides } as Product;
}

describe("diagnoseProductBookingUx", () => {
  it("flags seasonal products as no calendar/deposit", () => {
    const d = diagnoseProductBookingUx(
      baseProduct({
        seasonal_price_bands: { offSeason: 100000, weekend: null, peakSeason: null },
      }),
    );
    expect(d.bookingUxMode).toBe("seasonal_consult");
    expect(d.showCalendarBooking).toBe(false);
    expect(d.showDepositSection).toBe(false);
    expect(d.uiExpectation).toContain("미노출");
  });

  it("flags calendar_booking with range-only departures", () => {
    const d = diagnoseProductBookingUx(
      baseProduct({
        departure_from_date: "2026-07-01",
        departure_to_date: "2026-07-10",
      }),
    );
    expect(d.bookingUxMode).toBe("calendar_booking");
    expect(d.calendarDepartureCount).toBeGreaterThan(0);
    expect(d.scheduleRowCount).toBe(0);
    expect(d.hasBookingPanel).toBe(true);
  });
});
