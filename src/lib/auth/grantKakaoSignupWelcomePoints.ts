import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { grantPointsToUser } from "@/server/services/points/grantPoints";
import {
  KAKAO_SIGNUP_WELCOME_POINTS,
  KAKAO_SIGNUP_WELCOME_REASON,
  KAKAO_SIGNUP_WELCOME_REF_TYPE,
} from "@/lib/auth/kakaoSignupWelcome";

export type GrantKakaoSignupWelcomeResult =
  | { granted: true; ledgerId: string }
  | { granted: false; reason: "already_granted" };

export async function hasKakaoSignupWelcomePoints(memberId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("point_ledger")
    .select("id")
    .eq("user_id", memberId)
    .eq("ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function grantKakaoSignupWelcomePoints(
  memberId: string,
): Promise<GrantKakaoSignupWelcomeResult> {
  const userId = memberId.trim();
  if (!userId) throw new Error("memberId는 필수입니다.");

  if (await hasKakaoSignupWelcomePoints(userId)) {
    return { granted: false, reason: "already_granted" };
  }

  const { ledgerId } = await grantPointsToUser({
    userId,
    amount: KAKAO_SIGNUP_WELCOME_POINTS,
    status: "CONFIRMED",
    reason: KAKAO_SIGNUP_WELCOME_REASON,
    refType: KAKAO_SIGNUP_WELCOME_REF_TYPE,
    refId: userId,
    notificationTitle: "카카오 30,000P",
    notificationBody: `${KAKAO_SIGNUP_WELCOME_POINTS.toLocaleString("ko-KR")}P가 지급되었습니다. 빠른문의 시 사용할 수 있습니다.`,
  });

  return { granted: true, ledgerId };
}
