import { getMemberKakaoProviderUserId } from "@/lib/auth/memberAuthService";
import { buildPlannerKakaoMemoTemplateObject } from "@/lib/auth/kakao/buildPlannerKakaoMemoTemplate";
import { sendKakaoMemoDefault } from "@/lib/auth/kakao/kakaoMemo";
import { buildPlannerKakaoMemoRedirectPath } from "@/lib/auth/kakao/plannerKakaoMemoQuery";
import type { OAuthTokens } from "@/lib/auth/types";
import { getPlannerSessionById } from "@/lib/planner/repository";
import { persistAnalyticsEventAdmin } from "@/lib/analytics/persistAnalyticsEventAdmin";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type PlannerKakaoMemoActionFailureCode =
  | "missing_member"
  | "kakao_not_linked"
  | "account_mismatch"
  | "session_not_found"
  | "not_saved"
  | "forbidden"
  | "no_plan"
  | "memo_send_failed"
  | "unsupported_action";

export type PlannerKakaoMemoActionResult = {
  redirectPath: string;
  ok: boolean;
  failureCode?: PlannerKakaoMemoActionFailureCode;
};

function disposeTokens(tokens: OAuthTokens): void {
  // Best-effort: drop references so callers cannot reuse after return.
  (tokens as { accessToken: string }).accessToken = "";
  if (tokens.refreshToken) {
    (tokens as { refreshToken?: string }).refreshToken = "";
  }
}

/**
 * Executes planner_kakao_memo after ephemeral Kakao token exchange.
 * Does not persist tokens. Does not mutate planner save status.
 */
export async function runPlannerKakaoMemoAction(params: {
  tokens: OAuthTokens;
  kakaoProviderUserId: string;
  memberId: string;
  plannerSessionId: string;
}): Promise<PlannerKakaoMemoActionResult> {
  const memberId = params.memberId.trim();
  const plannerSessionId = params.plannerSessionId.trim();
  const kakaoProviderUserId = params.kakaoProviderUserId.trim();

  const fail = (
    code: PlannerKakaoMemoActionFailureCode,
  ): PlannerKakaoMemoActionResult => ({
    ok: false,
    failureCode: code,
    redirectPath: buildPlannerKakaoMemoRedirectPath(plannerSessionId || "unknown", "failed"),
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

    const templateObject = buildPlannerKakaoMemoTemplateObject({
      plan: session.plan,
      sessionId: session.id,
    });

    const sendResult = await sendKakaoMemoDefault({
      accessToken: params.tokens.accessToken,
      templateObject,
    });

    if (!sendResult.ok) {
      await persistAnalyticsEventAdmin({
        eventName: ANALYTICS_EVENTS.planner_kakao_memo_failed,
        source: ANALYTICS_SOURCES.planner,
        pagePath: `/planner/${session.id}`,
        productId: session.sourceProductId,
        metadata: {
          sessionId: session.id,
          destination: session.plan.destination.name.slice(0, 120),
          failureCode: sendResult.code,
        },
      }).catch(() => undefined);

      return {
        ok: false,
        failureCode: "memo_send_failed",
        redirectPath: buildPlannerKakaoMemoRedirectPath(session.id, "failed"),
      };
    }

    await persistAnalyticsEventAdmin({
      eventName: ANALYTICS_EVENTS.planner_kakao_memo_sent,
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
      redirectPath: buildPlannerKakaoMemoRedirectPath(session.id, "sent"),
    };
  } finally {
    disposeTokens(params.tokens);
  }
}
