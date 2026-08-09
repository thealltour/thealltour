import { describe, expect, it } from "vitest";
import { KAKAO_SIGNUP_WELCOME_REF_TYPE } from "@/lib/auth/kakaoSignupWelcome";
import {
  COUPON_PACKS,
  isLegacyCouponPointRefType,
  listHeldCouponPackNamesFromTiers,
  recommendCouponPackTier,
} from "@/lib/coupons/couponPacks";

describe("couponPacks", () => {
  it("defines welcome and returning packs", () => {
    expect(COUPON_PACKS.WELCOME.amount).toBe(50_000);
    expect(COUPON_PACKS.RETURNING.amount).toBe(30_000);
  });

  it("recommends tier from booking history", () => {
    expect(recommendCouponPackTier(false)).toBe("WELCOME");
    expect(recommendCouponPackTier(true)).toBe("RETURNING");
  });

  it("lists display names", () => {
    expect(listHeldCouponPackNamesFromTiers(["WELCOME", "RETURNING"])).toEqual([
      "5만원 쿠폰팩",
      "3만원 쿠폰팩",
    ]);
  });

  it("detects legacy point_ledger coupon refs", () => {
    expect(isLegacyCouponPointRefType("COUPON_PACK_WELCOME")).toBe(true);
    expect(isLegacyCouponPointRefType(KAKAO_SIGNUP_WELCOME_REF_TYPE)).toBe(true);
    expect(isLegacyCouponPointRefType("manual")).toBe(false);
  });
});
