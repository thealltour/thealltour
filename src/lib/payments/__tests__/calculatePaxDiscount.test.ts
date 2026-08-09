import { describe, expect, it } from "vitest";
import {
  calculatePaxDiscount,
  calculatePaxDiscountFromPack,
  capPaxDiscountAmount,
} from "@/lib/payments/calculatePaxDiscount";

describe("calculatePaxDiscountFromPack", () => {
  it("uses pack unit amount for total", () => {
    const r = calculatePaxDiscountFromPack({
      travelerCount: 4,
      tier: "WELCOME",
      unitAmount: 50_000,
    });
    expect(r.totalDiscount).toBe(200_000);
    expect(r.unitDiscount).toBe(50_000);
    expect(r.tier).toBe("WELCOME");
  });

  it("supports returning pack rates", () => {
    const r = calculatePaxDiscountFromPack({
      travelerCount: 2,
      tier: "RETURNING",
      unitAmount: 30_000,
    });
    expect(r.totalDiscount).toBe(60_000);
  });
});

describe("calculatePaxDiscount history fallback", () => {
  it("matches welcome rates", () => {
    expect(calculatePaxDiscount({ travelerCount: 1, hasPreviousBooking: false }).unitDiscount).toBe(
      50_000,
    );
  });
});

describe("capPaxDiscountAmount", () => {
  it("keeps deposit payable", () => {
    expect(
      capPaxDiscountAmount({ quoteTotal: 150_000, rawPaxDiscount: 50_000, depositAmount: 100_000 }),
    ).toBe(50_000);
  });
});
