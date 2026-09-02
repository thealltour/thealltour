import { describe, expect, it } from "vitest";
import {
  assertPortOnePaymentIdLength,
  createPortOneTransactionId,
  isValidPortOnePaymentId,
  MAX_PORTONE_PAYMENT_ID_LENGTH,
  resolvePortOneTransactionId,
} from "@/lib/payments/portone/createPortOneTransactionId";

describe("createPortOneTransactionId", () => {
  it("generates id within 40 chars for all prefixes", () => {
    for (const prefix of ["dep", "full", "bal", "ord"] as const) {
      const id = createPortOneTransactionId(prefix);
      expect(id.length).toBeLessThanOrEqual(MAX_PORTONE_PAYMENT_ID_LENGTH);
      expect(id.startsWith(`${prefix}-`)).toBe(true);
    }
  });

  it("generates distinct ids on consecutive calls", () => {
    const a = createPortOneTransactionId("dep");
    const b = createPortOneTransactionId("dep");
    expect(a).not.toBe(b);
  });

  it("full prefix stays under limit (previously 41 with UUID)", () => {
    const id = createPortOneTransactionId("full");
    expect(id.length).toBeLessThanOrEqual(40);
    expect(id.startsWith("full-")).toBe(true);
  });

  it("assertPortOnePaymentIdLength rejects overlong uuid-style id", () => {
    const tooLong = `full-${"a".repeat(36)}`;
    expect(tooLong.length).toBeGreaterThan(40);
    expect(() => assertPortOnePaymentIdLength(tooLong)).toThrow(
      "INVALID_PORTONE_PAYMENT_ID_LENGTH",
    );
  });

  it("resolvePortOneTransactionId uses valid candidate", () => {
    const candidate = createPortOneTransactionId("dep");
    expect(resolvePortOneTransactionId(candidate, "full")).toBe(candidate);
  });

  it("resolvePortOneTransactionId falls back on invalid candidate", () => {
    const invalid = `full-${"x".repeat(36)}`;
    const resolved = resolvePortOneTransactionId(invalid, "full");
    expect(isValidPortOnePaymentId(resolved)).toBe(true);
    expect(resolved.startsWith("full-")).toBe(true);
  });
});
