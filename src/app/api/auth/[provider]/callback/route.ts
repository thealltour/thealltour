import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOAuthStateToken, OAUTH_STATE_COOKIE } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { resolveKakaoWelcomeNextPath } from "@/lib/auth/kakaoSignupWelcome";
import { loginErrorRedirect } from "@/lib/auth/authErrors";
import { handleOAuthCallback, cleanupExpiredPendingLinks } from "@/lib/auth/memberAuthService";
import { appendMemberSessionCookie } from "@/lib/auth/setMemberSessionCookie";

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
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_cancelled"), request.url));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const state = verifyOAuthStateToken(stateParam) ?? verifyOAuthStateToken(cookieState);
  if (!state || state.provider !== providerId) {
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
    return NextResponse.redirect(new URL(loginErrorRedirect("oauth_failed", state.next), request.url));
  }
}
