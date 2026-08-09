import "server-only";

import { grantCouponPack } from "@/server/services/coupons/grantCouponPack";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  KAKAO_SIGNUP_WELCOME_POINTS,
  KAKAO_SIGNUP_WELCOME_REASON,
  KAKAO_SIGNUP_WELCOME_REF_TYPE,
} from "@/lib/auth/kakaoSignupWelcome";
import { COUPON_PACKS } from "@/lib/coupons/couponPacks";

export type GrantKakaoSignupWelcomeResult =
  | { granted: true; packId: string; ledgerId: string }
  | { granted: false; reason: "already_granted" };

/** 쿠폰팩 또는 레거시 포인트 마커로 이미 웰컴이 있는지 */
export async function hasKakaoSignupWelcomePoints(memberId: string): Promise<boolean> {
  const id = memberId.trim();
  if (!id) return false;

  const [{ data: pack }, { data: legacy }] = await Promise.all([
    supabaseAdmin
      .from("member_coupon_packs")
      .select("id")
      .eq("user_id", id)
      .eq("source_ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("point_ledger")
      .select("id")
      .eq("user_id", id)
      .eq("ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE)
      .limit(1)
      .maybeSingle(),
  ]);

  return Boolean(pack?.id || legacy?.id);
}

/** 카카오 신규 가입: 웰컴 쿠폰팩만 지급 (포인트 잔액 미반영) */
export async function grantKakaoSignupWelcomePoints(
  memberId: string,
): Promise<GrantKakaoSignupWelcomeResult> {
  const userId = memberId.trim();
  if (!userId) throw new Error("memberId는 필수입니다.");

  if (await hasKakaoSignupWelcomePoints(userId)) {
    return { granted: false, reason: "already_granted" };
  }

  const result = await grantCouponPack({
    userId,
    tier: "WELCOME",
    sourceRefType: KAKAO_SIGNUP_WELCOME_REF_TYPE,
    sourceRefId: userId,
    reason: KAKAO_SIGNUP_WELCOME_REASON,
    notificationTitle: "5만원 쿠폰팩",
    notificationBody: `${COUPON_PACKS.WELCOME.reason}이 지급되었습니다. 골프투어 예약 시 1인당 ${KAKAO_SIGNUP_WELCOME_POINTS.toLocaleString("ko-KR")}원 할인이 적용됩니다.`,
  });

  if (!result.granted) {
    return { granted: false, reason: "already_granted" };
  }

  return { granted: true, packId: result.packId, ledgerId: result.ledgerId };
}
