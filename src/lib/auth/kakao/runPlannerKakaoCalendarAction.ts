import { getMemberKakaoProviderUserId } from "@/lib/auth/memberAuthService";
import { buildPlannerKakaoCalendarEvent } from "@/lib/auth/kakao/buildPlannerKakaoCalendarEvent";
import { createKakaoCalendarEvent } from "@/lib/auth/kakao/kakaoCalendar";
import { buildPlannerKakaoCalendarRedirectPath } from "@/lib/auth/kakao/plannerKakaoCalendarQuery";
import type { OAuthTokens } from "@/lib/auth/types";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type PlannerKakaoCalendarActionFailureCode =
  | "missing_member"
  | "kakao_not_linked"
  | "account_mismatch"
  | "session_not_found"
  | "not_saved"
  | "forbidden"
  | "no_plan"
  | "missing_trip_dates"
  | "calendar_create_failed"
  | "calendar_permission_denied"
  | "unsupported_action";

export type PlannerKakaoCalendarActionResult = {
  redirectPath: string;
  ok: boolean;
  failureCode?: PlannerKakaoCalendarActionFailureCode;
};

function disposeTokens(tokens: OAuthTokens): void {
  (tokens as { accessToken: string }).accessToken = "";
  if (tokens.refreshToken) {
    (tokens as { refreshToken?: string }).refreshToken = "";
  }
}

/**
 * Executes planner_kakao_calendar after ephemeral Kakao token exchange.
 * Does not persist tokens or event_id. Does not mutate planner save status / plan_json.
 */
export async function runPlannerKakaoCalendarAction(params: {
  tokens: OAuthTokens;
  kakaoProviderUserId: string;
  memberId: string;
  plannerSessionId: string;
}): Promise<PlannerKakaoCalendarActionResult> {
  const memberId = params.memberId.trim();
  const plannerSessionId = params.plannerSessionId.trim();
  const kakaoProviderUserId = params.kakaoProviderUserId.trim();

  const fail = (
    code: PlannerKakaoCalendarActionFailureCode,
  ): PlannerKakaoCalendarActionResult => ({
    ok: false,
    failureCode: code,
    redirectPath: buildPlannerKakaoCalendarRedirectPath(
      plannerSessionId || "unknown",
      "failed",
    ),
  });

  try {
    if (!memberId) return fail("missing_member");
    if (!plannerSessionId) return fail("session_not_found");

    const linkedKakaoId = await getMemberKakaoProviderUserId(memberId);
    if (!linkedKakaoId) return fail("kakao_not_linked");
    if (linkedKakaoId !== kakaoProviderUserId) return fail("account_mismatch");

    const session = await getPlannerSessionById(plannerSessionId);
    if (!session) return fail("session_not_found");
    if (session.memberId !== memberId) return fail("forbidden");
    if (session.status !== "saved") return fail("not_saved");
    if (!session.plan) return fail("no_plan");

    let payload;
    try {
      payload = buildPlannerKakaoCalendarEvent({
        plan: session.plan,
        sessionId: session.id,
        originText: session.input.origin?.text ?? null,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "missing_trip_dates") {
        return fail("missing_trip_dates");
      }
      return fail("calendar_create_failed");
    }

    const createResult = await createKakaoCalendarEvent({
      accessToken: params.tokens.accessToken,
      payload,
    });

    if (!createResult.ok) {
      const failureCode: PlannerKakaoCalendarActionFailureCode =
        createResult.code === "calendar_permission_denied" ||
        createResult.code === "forbidden"
          ? "calendar_permission_denied"
          : "calendar_create_failed";

      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.planner_kakao_calendar_failed,
        source: ANALYTICS_SOURCES.planner,
        pagePath: `/planner/${session.id}`,
        productId: session.sourceProductId,
        metadata: {
          sessionId: session.id,
          destination: session.plan.destination.name.slice(0, 120),
          failureCode: createResult.code,
        },
      }).catch(() => undefined);

      return {
        ok: false,
        failureCode,
        redirectPath: buildPlannerKakaoCalendarRedirectPath(session.id, "failed"),
      };
    }

    await persistAnalyticsEventAdmin({
      eventName: ANALYTICS_EVENTS.planner_kakao_calendar_added,
      source: ANALYTICS_SOURCES.planner,
      pagePath: `/planner/${session.id}`,
      productId: session.sourceProductId,
      metadata: {
        sessionId: session.id,
        destination: session.plan.destination.name.slice(0, 120),
      },
    }).catch(() => undefined);

    return {
      ok: true,
      redirectPath: buildPlannerKakaoCalendarRedirectPath(session.id, "added"),
    };
  } finally {
    disposeTokens(params.tokens);
  }
}
