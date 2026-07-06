import { describe, expect, it } from "vitest";
import {
  normalizePointsUseRequested,
  resolveDefaultPointsUseAmount,
  validateInquiryPointsUse,
} from "@/lib/inquiry/inquiryPointsUse";

describe("inquiryPointsUse", () => {
  describe("normalizePointsUseRequested", () => {
    it("parses positive integers", () => {
      expect(normalizePointsUseRequested(10_000)).toBe(10_000);
      expect(normalizePointsUseRequested("15000")).toBe(15_000);
    });

    it("returns 0 for invalid values", () => {
      expect(normalizePointsUseRequested(0)).toBe(0);
      expect(normalizePointsUseRequested(-1)).toBe(0);
      expect(normalizePointsUseRequested(null)).toBe(0);
      expect(normalizePointsUseRequested("abc")).toBe(0);
    });
  });

  describe("validateInquiryPointsUse", () => {
    it("allows zero or omitted usage", () => {
      expect(validateInquiryPointsUse({ pointsUseRequested: 0, pointBalance: 0 })).toEqual({ ok: true });
    });

    it("rejects when balance is insufficient", () => {
      expect(validateInquiryPointsUse({ pointsUseRequested: 5_000, pointBalance: 1_000 })).toEqual({
        ok: false,
        message: "요청 포인트가 보유 잔액을 초과합니다.",
      });
    });

    it("accepts valid usage within balance", () => {
      expect(validateInquiryPointsUse({ pointsUseRequested: 30_000, pointBalance: 30_000 })).toEqual({
        ok: true,
      });
    });
  });

  describe("resolveDefaultPointsUseAmount", () => {
    it("caps by quote total when present", () => {
      expect(resolveDefaultPointsUseAmount(30_000, 20_000)).toBe(20_000);
    });

    it("uses full balance when quote total is absent", () => {
      expect(resolveDefaultPointsUseAmount(30_000, null)).toBe(30_000);
    });
  });
});
