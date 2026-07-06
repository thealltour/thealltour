import { describe, expect, it } from "vitest";
import {
  buildCheckoutQuote,
  CHECKOUT_DEPOSIT_AMOUNT,
  validateCheckoutQuote,
} from "@/lib/payments/buildCheckoutQuote";

describe("buildCheckoutQuote", () => {
  it("computes deposit and balance with departure price", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 500_000 },
      pointsUse: 30_000,
    });
    expect(quote.quoteTotal).toBe(500_000);
    expect(quote.pointsApplied).toBe(30_000);
    expect(quote.depositAmount).toBe(CHECKOUT_DEPOSIT_AMOUNT);
    expect(quote.balanceDue).toBe(500_000 - 30_000 - CHECKOUT_DEPOSIT_AMOUNT);
  });

  it("rejects when deposit exceeds payable total", () => {
    const quote = buildCheckoutQuote({
      selectedOptions: {},
      departure: { label: "7/1", inquiryValue: "7/1", price: 50_000 },
    });
    const validation = validateCheckoutQuote(quote);
    expect(validation.ok).toBe(false);
  });
});
