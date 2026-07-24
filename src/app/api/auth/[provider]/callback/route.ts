import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOAuthStateToken, OAUTH_STATE_COOKIE } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { resolveKakaoWelcomeNextPath } from "@/lib/auth/kakaoSignupWelcome";
import { loginErrorRedirect } from "@/lib/auth/authErrors";
import { handleOAuthCallback, cleanupExpiredPendingLinks } from "@/lib/auth/memberAuthService";
import { appendMemberSessionCookie } from "@/lib/auth/setMemberSessionCookie";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { isKakaoSyncFunnelAcquisition } from "@/lib/analytics/kakaoSyncLandingHit";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { provider: providerId } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  if (!isAuthProviderId(providerId)) {
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_unavailable"), request.url));
  }

  if (oauthError || !code) {
    if (providerId === "kakao") {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.kakao_oauth_failed,
        source: ANALYTICS_SOURCES.kakao_sync_auth,
        pagePath: "/api/auth/kakao/callback",
        metadata: { reason: oauthError ? "oauth_error" : "missing_code", oauthError },
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_cancelled"), request.url));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const state = verifyOAuthStateToken(stateParam) ?? verifyOAuthStateToken(cookieState);
  if (!state || state.provider !== providerId) {
    if (providerId === "kakao") {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.kakao_oauth_failed,
        source: ANALYTICS_SOURCES.kakao_sync_auth,
        pagePath: "/api/auth/kakao/callback",
        metadata: { reason: "oauth_invalid_state" },
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_invalid_state"), request.url));
  }

  const adapter = getOAuthProvider(providerId);
  if (!adapter?.isConfigured()) {
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

    if (result.type === "link_account") {
      const linkUrl = new URL("/auth/link-account", request.url);
      linkUrl.searchParams.set("pending", result.pendingId);
      linkUrl.searchParams.set("email", result.email);
      linkUrl.searchParams.set("provider", result.provider);
      const response = NextResponse.redirect(linkUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    if (providerId === "kakao") {
      const acquisition = state.acquisition ?? null;
      const fromKakaoLanding = isKakaoSyncFunnelAcquisition(acquisition);
      const funnelMeta = fromKakaoLanding ? { funnel: "kakao_sync" as const } : {};
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
    if (result.kakaoWelcomeGranted) {
      destination = resolveKakaoWelcomeNextPath(result.next);
    }

    if (result.needsProfile) {
      destination = `/auth/complete-profile?next=${encodeURIComponent(destination)}`;
    }

    const response = NextResponse.redirect(new URL(destination, request.url));
    appendMemberSessionCookie(response, result.member);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error(`[auth/${providerId}/callback]`, err);
    if (providerId === "kakao") {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.kakao_oauth_failed,
        source: ANALYTICS_SOURCES.kakao_sync_auth,
        pagePath: "/api/auth/kakao/callback",
        sourcePath: state.acquisition?.landing_path ?? null,
        landingSlug: state.acquisition?.landing_slug ?? null,
        metadata: { reason: "oauth_failed", message: err instanceof Error ? err.message : "unknown" },
      });
    }
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_failed", state.next), request.url));
  }
}
