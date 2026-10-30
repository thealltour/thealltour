import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { createOAuthStateToken, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/lib/auth/oauthState";
import {
  buildPlannerKakaoMemoAction,
  isPlannerSessionId,
  scopesForOAuthAction,
} from "@/lib/auth/oauthAction";
import { getOAuthProvider } from "@/lib/auth/providerRegistry";
import { getOAuthRedirectUri, sanitizeNextPath } from "@/lib/auth/redirect";
import { buildPlannerKakaoMemoRedirectPath } from "@/lib/auth/kakao/plannerKakaoMemoQuery";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/planner/sessions/[id]/kakao-memo/start
 * Starts action-specific Kakao OAuth with talk_message (on-demand).
 * Does not accept client memberId. Tokens are never stored.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const sessionId = rawId?.trim() ?? "";

  const failRedirect = (status: "failed" = "failed") =>
    NextResponse.redirect(
      new URL(
        buildPlannerKakaoMemoRedirectPath(
          isPlannerSessionId(sessionId) ? sessionId : "00000000-0000-4000-8000-000000000000",
          status,
        ),
        _request.url,
      ),
    );

  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    return NextResponse.json({ message: "Planner is disabled." }, { status: 404 });
  }

  if (!isPlannerSessionId(sessionId)) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);
  if (!memberSession?.memberId) {
    return NextResponse.json({ message: "로그인이 필요합니다.", code: "unauthorized" }, { status: 401 });
  }

  const session = await getPlannerSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ message: "Planner session not found." }, { status: 404 });
  }
  if (session.memberId !== memberSession.memberId) {
    return NextResponse.json({ message: "플랜을 보낼 수 없습니다." }, { status: 403 });
  }
  if (session.status !== "saved" || !session.plan) {
    return NextResponse.json(
      { message: "저장된 플랜만 카카오톡으로 보낼 수 있습니다.", code: "not_saved" },
      { status: 409 },
    );
  }

  const adapter = getOAuthProvider("kakao");
  if (!adapter?.isConfigured()) {
    return failRedirect("failed");
  }

  let action;
  try {
    action = buildPlannerKakaoMemoAction(sessionId);
  } catch {
    return failRedirect("failed");
  }

  const next = sanitizeNextPath(`/planner/${sessionId}`);
  const stateToken = createOAuthStateToken({
    provider: "kakao",
    mode: "login",
    next,
    memberId: memberSession.memberId,
    action,
  });

  const additionalScopes = scopesForOAuthAction(action);
  const redirectUri = getOAuthRedirectUri("kakao");
  const authorizeUrl = adapter.getAuthorizationUrl({
    state: stateToken,
    redirectUri,
    additionalScopes,
  });

  await persistAnalyticsEventAdmin({
    eventName: ANALYTICS_EVENTS.planner_kakao_memo_oauth_started,
    source: ANALYTICS_SOURCES.planner,
    pagePath: `/planner/${sessionId}`,
    productId: session.sourceProductId,
    metadata: {
      sessionId,
      destination: session.plan.destination.name.slice(0, 120),
    },
  }).catch(() => undefined);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, stateToken, OAUTH_STATE_COOKIE_OPTIONS);
  return response;
}
