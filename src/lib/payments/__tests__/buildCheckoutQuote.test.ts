import { describe, expect, it } from "vitest";
import {
  buildCheckoutQuote,
  validateCheckoutQuote,
} from "@/lib/payments/buildCheckoutQuote";

describe("buildCheckoutQuote", () => {
  it("computes quote total with departure price and points", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      pointsUse: 30_000,
    });
    expect(quote.quoteTotal).toBe(500_000);
    expect(quote.pointsApplied).toBe(30_000);
    expect(quote.paxDiscountAmount).toBe(0);
  });

  it("multiplies quote by travelerCount", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 4,
    });
    expect(quote.quoteTotal).toBe(2_000_000);
    expect(quote.travelerCount).toBe(4);
  });

  it("applies WELCOME pax discount for first booking", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 4,
      applyPaxDiscount: true,
      hasPreviousBooking: false,
    });
    expect(quote.paxDiscountAmount).toBe(200_000);
    expect(quote.discountTier).toBe("WELCOME");
    expect(quote.discountLabel).toContain("웰컴");
  });

  it("applies RETURNING pax discount when has previous booking", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 2,
      applyPaxDiscount: true,
      hasPreviousBooking: true,
    });
    expect(quote.paxDiscountAmount).toBe(60_000);
    expect(quote.discountTier).toBe("RETURNING");
  });

  it("caps pax discount at quote total", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 300_000 },
      travelerCount: 1,
      applyPaxDiscount: true,
      hasPreviousBooking: false,
    });
    expect(quote.paxDiscountAmount).toBe(50_000);
    expect(validateCheckoutQuote(quote).ok).toBe(true);
  });

  it("stacks optional points after pax discount without exceeding payable", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 2,
      applyPaxDiscount: true,
      hasPreviousBooking: false,
      pointsUse: 20_000,
    });
    expect(quote.paxDiscountAmount).toBe(100_000);
    expect(quote.pointsApplied).toBe(20_000);
    expect(validateCheckoutQuote(quote).ok).toBe(true);
  });

  it("package_points mode: no pax discount, points apply", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 2,
      applyPaxDiscount: false,
      pointsUse: 30_000,
    });
    expect(quote.paxDiscountAmount).toBe(0);
    expect(quote.pointsApplied).toBe(30_000);
  });

  it("golf_coupon mode: pax discount with points forced to 0 at caller", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      travelerCount: 2,
      applyPaxDiscount: true,
      hasPreviousBooking: false,
      pointsUse: 0,
    });
    expect(quote.paxDiscountAmount).toBe(100_000);
    expect(quote.pointsApplied).toBe(0);
  });

  it("rejects when quote total is zero", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 0 },
    });
    const validation = validateCheckoutQuote(quote);
    expect(validation.ok).toBe(false);
  });
});
