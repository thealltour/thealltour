import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOAuthStateToken, OAUTH_STATE_COOKIE } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { resolveKakaoWelcomeNextPath, resolveKakaoSyncPostAuthDestination } from "@/lib/auth/kakaoSignupWelcome";
import { loginErrorRedirect } from "@/lib/auth/authErrors";
import { handleOAuthCallback, cleanupExpiredPendingLinks } from "@/lib/auth/memberAuthService";
import { appendMemberSessionCookie } from "@/lib/auth/setMemberSessionCookie";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { isKakaoSyncFunnelAcquisition } from "@/lib/analytics/kakaoSyncLandingHit";
import {
  buildKakaoOAuthFailureMetadata,
  kakaoOAuthFailureAttribution,
  type KakaoOAuthFailureReason,
} from "@/lib/analytics/kakaoOAuthFailureMetadata";
import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";

type RouteContext = { params: Promise<{ provider: string }> };

async function persistKakaoOAuthFailure(input: {
  reason: KakaoOAuthFailureReason;
  acquisition?: MemberAcquisition | null;
  oauthError?: string | null;
  oauthErrorDescription?: string | null;
  message?: string | null;
}) {
  const acquisition = input.acquisition ?? null;
  const { sourcePath, landingSlug } = kakaoOAuthFailureAttribution(acquisition);
  await persistAnalyticsEventAdmin({
    eventName: ANALYTICS_EVENTS.kakao_oauth_failed,
    source: ANALYTICS_SOURCES.kakao_sync_auth,
    pagePath: "/api/auth/kakao/callback",
    sourcePath,
    landingSlug,
    metadata: buildKakaoOAuthFailureMetadata({
      reason: input.reason,
      oauthError: input.oauthError,
      oauthErrorDescription: input.oauthErrorDescription,
      message: input.message,
      acquisition,
    }),
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { provider: providerId } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const stateParam = url.searchParams.get("state");

  if (!isAuthProviderId(providerId)) {
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_unavailable"), request.url));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  /** 취소·오류 시에도 acquisition을 붙이기 위해 state를 먼저 해석 */
  const earlyState = verifyOAuthStateToken(stateParam) ?? verifyOAuthStateToken(cookieState);

  if (oauthError || !code) {
    if (providerId === "kakao") {
      await persistKakaoOAuthFailure({
        reason: oauthError ? "oauth_error" : "missing_code",
        acquisition: earlyState?.acquisition ?? null,
        oauthError,
        oauthErrorDescription,
      });
    }
    const response = NextResponse.redirect(new URL(loginErrorRedirect("oauth_cancelled"), request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  const state = earlyState;
  if (!state || state.provider !== providerId) {
    if (providerId === "kakao") {
      await persistKakaoOAuthFailure({
        reason: "oauth_invalid_state",
        acquisition: earlyState?.acquisition ?? null,
        oauthErrorDescription,
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_invalid_state"), request.url));
  }

  const adapter = getOAuthProvider(providerId);
  if (!adapter?.isConfigured()) {
    if (providerId === "kakao") {
      await persistKakaoOAuthFailure({
        reason: "oauth_unavailable",
        acquisition: state.acquisition ?? null,
        message: "kakao_adapter_not_configured",
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_unavailable"), request.url));
  }

  try {
    await cleanupExpiredPendingLinks();
    const redirectUri = getOAuthRedirectUri(providerId);
    const tokens = await adapter.exchangeCode(code, redirectUri, stateParam ?? undefined);
    const profile = await adapter.fetchProfile(tokens);

    const result = await handleOAuthCallback({
      provider: providerId,
      profile,
      mode: state.mode,
      linkMemberId: state.memberId,
      next: sanitizeNextPath(state.next),
      acquisition: state.acquisition ?? null,
    });

    const acquisition = state.acquisition ?? null;
    const fromKakaoLanding = isKakaoSyncFunnelAcquisition(acquisition);
    const funnelMeta = fromKakaoLanding ? { funnel: "kakao_sync" as const } : {};

    if (result.type === "link_account") {
      if (providerId === "kakao") {
        await persistAnalyticsEventAdmin({
          eventName: ANALYTICS_EVENTS.kakao_oauth_success,
          source: ANALYTICS_SOURCES.kakao_sync_auth,
          pagePath: "/api/auth/kakao/callback",
          sourcePath: acquisition?.landing_path ?? null,
          landingSlug: acquisition?.landing_slug ?? null,
          metadata: {
            ...funnelMeta,
            needsLink: true,
            isNewMember: false,
            acquisition,
          },
        });
      }
      const linkUrl = new URL("/auth/link-account", request.url);
      linkUrl.searchParams.set("pending", result.pendingId);
      linkUrl.searchParams.set("identifier", result.identifier);
      linkUrl.searchParams.set("matched_by", result.matchedBy);
      linkUrl.searchParams.set("provider", result.provider);
      const response = NextResponse.redirect(linkUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    if (providerId === "kakao") {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.kakao_oauth_success,
        source: ANALYTICS_SOURCES.kakao_sync_auth,
        pagePath: "/api/auth/kakao/callback",
        sourcePath: acquisition?.landing_path ?? null,
        landingSlug: acquisition?.landing_slug ?? null,
        metadata: {
          ...funnelMeta,
          isNewMember: Boolean(result.isNewMember),
          acquisition,
        },
      });
      await persistAnalyticsEventAdmin({
        eventName: result.isNewMember
          ? ANALYTICS_EVENTS.kakao_signup_new
          : ANALYTICS_EVENTS.kakao_login_returning,
        source: ANALYTICS_SOURCES.kakao_sync_auth,
        pagePath: "/api/auth/kakao/callback",
        sourcePath: acquisition?.landing_path ?? null,
        landingSlug: acquisition?.landing_slug ?? null,
        metadata: {
          ...funnelMeta,
          memberId: result.member.id,
          welcomeGranted: Boolean(result.kakaoWelcomeGranted),
          acquisition,
        },
      });
    }

    let destination = result.next;
    if (fromKakaoLanding) {
      // 싱크 동의로 약관·추가입력을 갈음 — complete-profile 미경유, 대시보드 직행
      destination = resolveKakaoSyncPostAuthDestination({
        next: result.next,
        welcomeGranted: Boolean(result.kakaoWelcomeGranted),
      });
    } else {
      if (result.kakaoWelcomeGranted) {
        destination = resolveKakaoWelcomeNextPath(result.next);
      }
      if (result.needsProfile) {
        destination = `/auth/complete-profile?next=${encodeURIComponent(destination)}`;
      }
    }

    const response = NextResponse.redirect(new URL(destination, request.url));
    appendMemberSessionCookie(response, result.member);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error(`[auth/${providerId}/callback]`, err);
    if (providerId === "kakao") {
      await persistKakaoOAuthFailure({
        reason: "oauth_failed",
        acquisition: state.acquisition ?? null,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_failed", state.next), request.url));
  }
}
