import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";
import { isKakaoSyncFunnelAcquisition } from "@/lib/analytics/kakaoSyncLandingHit";

export type KakaoOAuthFailureReason =
  | "oauth_error"
  | "missing_code"
  | "oauth_invalid_state"
  | "oauth_failed"
  | "oauth_unavailable";

const MESSAGE_MAX = 200;

export function truncateOAuthFailureMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  return trimmed.length > MESSAGE_MAX ? `${trimmed.slice(0, MESSAGE_MAX)}…` : trimmed;
}

/**
 * 카카오 OAuth 콜백 실패 시 analytics_events.metadata 표준 필드.
 * 스키마 변경 없이 JSONB로 원인 코드를 백엔드·어드민에서 조회한다.
 */
export function buildKakaoOAuthFailureMetadata(input: {
  reason: KakaoOAuthFailureReason;
  oauthError?: string | null;
  oauthErrorDescription?: string | null;
  message?: string | null;
  acquisition?: MemberAcquisition | null;
}): Record<string, unknown> {
  const acquisition = input.acquisition ?? null;
  const fromKakaoLanding = isKakaoSyncFunnelAcquisition(acquisition);
  const oauthError = input.oauthError?.trim() || null;
  const oauthErrorDescription = input.oauthErrorDescription?.trim() || null;
  const message = truncateOAuthFailureMessage(input.message);

  return {
    provider: "kakao",
    reason: input.reason,
    oauthError,
    oauthErrorDescription,
    ...(message ? { message } : {}),
    ...(fromKakaoLanding ? { funnel: "kakao_sync" as const } : {}),
    acquisition,
  };
}

/** 어드민 source_path / landing_slug 컬럼용 — acquisition이 있을 때만 */
export function kakaoOAuthFailureAttribution(acquisition: MemberAcquisition | null | undefined): {
  sourcePath: string | null;
  landingSlug: string | null;
} {
  if (!acquisition) return { sourcePath: null, landingSlug: null };
  return {
    sourcePath: acquisition.landing_path?.trim() || null,
    landingSlug: acquisition.landing_slug?.trim() || null,
  };
}
