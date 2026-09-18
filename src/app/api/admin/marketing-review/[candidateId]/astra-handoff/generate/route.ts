import { requireAdminPermission } from "@/lib/apiAuth";
import { CHANNEL_REGENERATE_COMPOSER_TIMEOUT_MS_DEFAULT } from "@/lib/marketing/cron/marketingPlanSpecialists";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import {
  astraHandoffOperatorErrorResponse,
  generateAstraHandoffForCandidate,
} from "@/lib/marketing/publishable/visualOrchestration/operatorService";
import {
  ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
  ensureAstraHandoffWriterHermesReady,
} from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Explicit Astra Handoff generation (LLM Handoff Writer).
 * Requires a fresh Shared Visual Plan.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    ensureAstraHandoffWriterHermesReady();
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      CHANNEL_REGENERATE_COMPOSER_TIMEOUT_MS_DEFAULT,
    );
    const result = await generateAstraHandoffForCandidate({
      candidateId,
      invoke: (prompt) =>
        invokeHermesProfileAsync(ASTRA_HANDOFF_WRITER_HERMES_PROFILE, prompt, timeoutMs),
    });

    if (!result.ok) {
      const status =
        result.error?.code === "shared_visual_plan_stale" ||
        result.error?.code === "shared_visual_plan_missing"
          ? 409
          : 502;
      return Response.json(
        {
          ok: false,
          message: result.error?.message ?? "Astra Handoff 생성에 실패했습니다.",
          code: result.error?.code ?? "astra_handoff_writer_failed",
          handoffStatus: result.handoffStatus,
          visualCount: result.visualCount,
          previousHandoffPreserved: result.previousHandoffPreserved ?? true,
          modelProfile: ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
        },
        { status },
      );
    }

    return Response.json({
      ok: true,
      handoffStatus: result.handoffStatus,
      visualCount: result.visualCount,
      modelProfile: ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
      message: "Astra Handoff를 생성했습니다.",
    });
  } catch (error) {
    return astraHandoffOperatorErrorResponse(error);
  }
}
