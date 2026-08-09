import { KAKAO_SIGNUP_WELCOME_REF_TYPE } from "@/lib/auth/kakaoSignupWelcome";
import type { CouponPackTier } from "@/types/coupons";

export type CouponPackDef = {
  tier: CouponPackTier;
  amount: number;
  reason: string;
  refType: string;
  label: string;
  buttonLabel: string;
};

export const COUPON_PACKS: Record<CouponPackTier, CouponPackDef> = {
  WELCOME: {
    tier: "WELCOME",
    amount: 50_000,
    reason: "5만원 쿠폰팩",
    refType: "COUPON_PACK_WELCOME",
    label: "웰컴(미예약)",
    buttonLabel: "웰컴 5만 쿠폰팩",
  },
  RETURNING: {
    tier: "RETURNING",
    amount: 30_000,
    reason: "3만원 쿠폰팩",
    refType: "COUPON_PACK_RETURNING",
    label: "리턴(예약확정/완료)",
    buttonLabel: "리턴 3만 쿠폰팩",
  },
};

/** 레거시 point_ledger 웰컴 마커 (백필·중복 판정용) */
export const WELCOME_PACK_SOURCE_REF_TYPES = [
  COUPON_PACKS.WELCOME.refType,
  KAKAO_SIGNUP_WELCOME_REF_TYPE,
] as const;

export const RETURNING_PACK_SOURCE_REF_TYPES = [COUPON_PACKS.RETURNING.refType] as const;

export function recommendCouponPackTier(hasConfirmedBooking: boolean): CouponPackTier {
  return hasConfirmedBooking ? "RETURNING" : "WELCOME";
}

export function couponPackDisplayName(tier: CouponPackTier): string {
  return COUPON_PACKS[tier].reason;
}

export function listHeldCouponPackNamesFromTiers(tiers: CouponPackTier[]): string[] {
  const unique = [...new Set(tiers)];
  return unique.map((t) => COUPON_PACKS[t].reason);
}

/** @deprecated point_ledger 쿠폰 마커 쓰기 금지 — grantCouponPack 사용 */
export function isLegacyCouponPointRefType(refType: string | null | undefined): boolean {
  if (!refType) return false;
  return (
    refType === COUPON_PACKS.WELCOME.refType ||
    refType === COUPON_PACKS.RETURNING.refType ||
    refType === KAKAO_SIGNUP_WELCOME_REF_TYPE
  );
}
