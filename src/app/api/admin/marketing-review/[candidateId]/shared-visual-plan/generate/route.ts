import { requireAdminPermission } from "@/lib/apiAuth";
import {
  CHANNEL_REGENERATE_COMPOSER_TIMEOUT_MS_DEFAULT,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import {
  astraHandoffOperatorErrorResponse,
  generateSharedVisualPlanForCandidate,
} from "@/lib/marketing/publishable/visualOrchestration/operatorService";
import {
  ensureSharedVisualPlannerHermesReady,
  SHARED_VISUAL_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Explicit Shared Visual Plan generation (LLM Shared Visual Planner).
 * Does not run on channel generate/regenerate.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    ensureSharedVisualPlannerHermesReady();
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      CHANNEL_REGENERATE_COMPOSER_TIMEOUT_MS_DEFAULT,
    );
    const result = await generateSharedVisualPlanForCandidate({
      candidateId,
      invoke: (prompt) =>
        invokeHermesProfileAsync(SHARED_VISUAL_PLANNER_HERMES_PROFILE, prompt, timeoutMs),
    });

    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          message: result.error?.message ?? "Shared Visual Plan 생성에 실패했습니다.",
          code: result.error?.code ?? "shared_visual_planner_failed",
          planStatus: result.planStatus,
          visualCount: result.visualCount,
          previousPlanPreserved: result.previousPlanPreserved ?? true,
          modelProfile: SHARED_VISUAL_PLANNER_HERMES_PROFILE,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      planStatus: result.planStatus,
      visualCount: result.visualCount,
      warnings: result.warnings ?? [],
      modelProfile: SHARED_VISUAL_PLANNER_HERMES_PROFILE,
      message: "Shared Visual Plan을 생성했습니다. 기존 Astra Handoff는 stale일 수 있습니다.",
    });
  } catch (error) {
    return astraHandoffOperatorErrorResponse(error);
  }
}
