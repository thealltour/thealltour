/**
 * OAuth 콜백에서 기존 회원 매칭 방식.
 * 카카오싱크는 전화만 식별자로 쓰고, 이메일·이름은 신규 가입으로 취급한다.
 */

import { isKakaoSyncFunnelAcquisition } from "@/lib/analytics/kakaoSyncLandingHit";
import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";

export type OAuthIdentityMatchMode = "phone_only" | "email_then_phone";

export function resolveOAuthIdentityMatchMode(
  acquisition?: MemberAcquisition | null,
): OAuthIdentityMatchMode {
  return isKakaoSyncFunnelAcquisition(acquisition ?? null) ? "phone_only" : "email_then_phone";
}
