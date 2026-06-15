import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createOAuthStateToken, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { loginErrorRedirect } from "@/lib/auth/authErrors";
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
  });

  const redirectUri = getOAuthRedirectUri(providerId);
  const authorizeUrl = adapter.getAuthorizationUrl({ state: stateToken, redirectUri });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, stateToken, OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
