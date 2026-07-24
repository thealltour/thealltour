import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createOAuthStateToken, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { loginErrorRedirect } from "@/lib/auth/authErrors";
import { parseMemberAcquisitionFromSearchParams } from "@/lib/auth/memberAcquisition";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import type { AuthMode } from "@/lib/auth/types";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { provider: providerId } = await context.params;
  if (!isAuthProviderId(providerId)) {
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_unavailable"), request.url));
  }

  const adapter = getOAuthProvider(providerId);
  if (!adapter?.isConfigured()) {
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_unavailable"), request.url));
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") === "link" ? "link" : "login") satisfies AuthMode;
  const next = sanitizeNextPath(url.searchParams.get("next"));
  const acquisition = parseMemberAcquisitionFromSearchParams(url.searchParams);

  let linkMemberId: string | undefined;
  if (mode === "link") {
    const cookieStore = await cookies();
    const session = getMemberSessionFromCookies(cookieStore);
    if (!session) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/mypage/profile")}`, request.url));
    }
    linkMemberId = session.memberId;
  }

  const stateToken = createOAuthStateToken({
    provider: providerId,
    mode,
    next,
    memberId: linkMemberId,
    acquisition,
  });

  if (providerId === "kakao") {
    await persistAnalyticsEventAdmin({
      eventName: ANALYTICS_EVENTS.kakao_oauth_start,
      source: ANALYTICS_SOURCES.kakao_sync_auth,
      pagePath: "/api/auth/kakao/start",
      sourcePath: acquisition?.landing_path ?? null,
      landingSlug: acquisition?.landing_slug ?? null,
      templateType:
        acquisition?.landing_slug === "kakao-sync" ? "kakao_sync_golf" : acquisition?.landing_slug ? "mobile_golf_ad" : null,
      metadata: {
        funnel: "kakao_sync",
        mode,
        acquisition: acquisition ?? null,
      },
    });
  }

  const redirectUri = getOAuthRedirectUri(providerId);
  const authorizeUrl = adapter.getAuthorizationUrl({ state: stateToken, redirectUri });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, stateToken, OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
