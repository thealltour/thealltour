import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOAuthStateToken, OAUTH_STATE_COOKIE } from "@/lib/auth/oauthState";
import { getOAuthProvider, isAuthProviderId } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { resolveKakaoWelcomeNextPath, resolveKakaoSyncPostAuthDestination } from "@/lib/auth/kakaoSignupWelcome";
import { withKakaoPixelSignupQuery } from "@/lib/analytics/kakaoPixel";
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
import { runPlannerKakaoMemoAction } from "@/lib/auth/kakao/runPlannerKakaoMemoAction";
import { buildPlannerKakaoMemoRedirectPath } from "@/lib/auth/kakao/plannerKakaoMemoQuery";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

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

function plannerMemoFailRedirect(request: Request, plannerSessionId: string) {
  const response = NextResponse.redirect(
    new URL(buildPlannerKakaoMemoRedirectPath(plannerSessionId, "failed"), request.url),
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
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
  const earlyMemoAction =
    earlyState?.action?.type === "planner_kakao_memo" ? earlyState.action : null;

  if (oauthError || !code) {
    if (earlyMemoAction) {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.planner_kakao_memo_failed,
        source: ANALYTICS_SOURCES.planner,
        pagePath: `/planner/${earlyMemoAction.plannerSessionId}`,
        metadata: {
          sessionId: earlyMemoAction.plannerSessionId,
          failureCode: oauthError ? "oauth_error" : "missing_code",
        },
      }).catch(() => undefined);
      return plannerMemoFailRedirect(request, earlyMemoAction.plannerSessionId);
    }
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
    if (earlyMemoAction) {
      return plannerMemoFailRedirect(request, earlyMemoAction.plannerSessionId);
    }
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
    if (state.action?.type === "planner_kakao_memo") {
      return plannerMemoFailRedirect(request, state.action.plannerSessionId);
    }
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

    // ——— Action-specific Kakao OAuth (planner memo). Does not create login session. ———
    if (state.action?.type === "planner_kakao_memo") {
      const plannerSessionId = state.action.plannerSessionId;
      const cookieMember = getMemberSessionFromCookies(cookieStore);
      const stateMemberId = state.memberId?.trim() ?? "";

      if (
        !stateMemberId ||
        !cookieMember?.memberId ||
        cookieMember.memberId !== stateMemberId ||
        providerId !== "kakao"
      ) {
        await persistAnalyticsEventAdmin({
          eventName: ANALYTICS_EVENTS.planner_kakao_memo_failed,
          source: ANALYTICS_SOURCES.planner,
          pagePath: `/planner/${plannerSessionId}`,
          metadata: {
            sessionId: plannerSessionId,
            failureCode: "session_mismatch",
          },
        }).catch(() => undefined);
        // Drop ephemeral tokens without logging
        (tokens as { accessToken: string }).accessToken = "";
        if (tokens.refreshToken) (tokens as { refreshToken?: string }).refreshToken = "";
        return plannerMemoFailRedirect(request, plannerSessionId);
      }

      const actionResult = await runPlannerKakaoMemoAction({
        tokens,
        kakaoProviderUserId: profile.providerUserId,
        memberId: stateMemberId,
        plannerSessionId,
      });

      // Analytics for sent/failed (memo API / identity) are emitted inside runPlannerKakaoMemoAction.
      // Pre-run session_mismatch already tracked above.
      if (!actionResult.ok && actionResult.failureCode && actionResult.failureCode !== "memo_send_failed") {
        await persistAnalyticsEventAdmin({
          eventName: ANALYTICS_EVENTS.planner_kakao_memo_failed,
          source: ANALYTICS_SOURCES.planner,
          pagePath: `/planner/${plannerSessionId}`,
          metadata: {
            sessionId: plannerSessionId,
            failureCode: actionResult.failureCode,
          },
        }).catch(() => undefined);
      }

      const response = NextResponse.redirect(new URL(actionResult.redirectPath, request.url));
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    // ——— Normal login / link flow (unchanged contract) ———
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
      // 카카오 OAuth 동의 화면에 서비스 약관 포함 → complete-profile 미경유 (Google/Naver만 게이트)
      if (result.needsProfile && providerId !== "kakao") {
        destination = `/auth/complete-profile?next=${encodeURIComponent(destination)}`;
      }
    }

    destination = withKakaoPixelSignupQuery({
      provider: providerId,
      isNewMember: result.isNewMember,
      destination,
    });

    const response = NextResponse.redirect(new URL(destination, request.url));
    appendMemberSessionCookie(response, result.member);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error(`[auth/${providerId}/callback]`, err);
    if (state.action?.type === "planner_kakao_memo") {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.planner_kakao_memo_failed,
        source: ANALYTICS_SOURCES.planner,
        pagePath: `/planner/${state.action.plannerSessionId}`,
        metadata: {
          sessionId: state.action.plannerSessionId,
          failureCode: "oauth_failed",
        },
      }).catch(() => undefined);
      return plannerMemoFailRedirect(request, state.action.plannerSessionId);
    }
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
