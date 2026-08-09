/**
 * 하위 호환 re-export — 신규 코드는 `@/lib/coupons/couponPacks` 사용
 */
import { KAKAO_SIGNUP_WELCOME_REF_TYPE } from "@/lib/auth/kakaoSignupWelcome";
import {
  COUPON_PACKS,
  couponPackDisplayName,
  isLegacyCouponPointRefType,
  listHeldCouponPackNamesFromTiers,
  recommendCouponPackTier,
  RETURNING_PACK_SOURCE_REF_TYPES,
  WELCOME_PACK_SOURCE_REF_TYPES,
  type CouponPackDef,
} from "@/lib/coupons/couponPacks";
import type { CouponPackTier } from "@/types/coupons";

export {
  COUPON_PACKS,
  couponPackDisplayName,
  recommendCouponPackTier,
  type CouponPackDef,
};
export type { CouponPackTier };

export const WELCOME_PACK_REF_TYPES = WELCOME_PACK_SOURCE_REF_TYPES;
export const RETURNING_PACK_REF_TYPES = RETURNING_PACK_SOURCE_REF_TYPES;

export function isWelcomePackRefType(refType: string | null | undefined): boolean {
  if (!refType) return false;
  return (WELCOME_PACK_SOURCE_REF_TYPES as readonly string[]).includes(refType);
}

export function isReturningPackRefType(refType: string | null | undefined): boolean {
  return refType === COUPON_PACKS.RETURNING.refType;
}

/** @deprecated 쿠폰은 grantCouponPack 사용. 레거시 point_ledger 마커 판정용 */
export function isBalanceExemptCouponPackRefType(refType: string | null | undefined): boolean {
  return isLegacyCouponPointRefType(refType);
}

export function listHeldCouponPackNames(params: {
  hasWelcomePack: boolean;
  hasReturningPack: boolean;
}): string[] {
  const tiers: CouponPackTier[] = [];
  if (params.hasWelcomePack) tiers.push("WELCOME");
  if (params.hasReturningPack) tiers.push("RETURNING");
  return listHeldCouponPackNamesFromTiers(tiers);
}

void KAKAO_SIGNUP_WELCOME_REF_TYPE;
