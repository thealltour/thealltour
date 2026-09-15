import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import {
  approveCanonicalAssetAndGenerateChannels,
  saveCanonicalAssetHumanEdit,
} from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import {
  createMarketingCronCorrelationId,
  createPublishableComposerInvoke,
  isAiRuntimeMarketingCronEnabled,
} from "@/lib/marketing/cron/marketingCronRuntime";
import { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } from "@/lib/marketing/cron/marketingPlanSpecialists";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import {
  assertHermesSpawnSyncSuccess,
  resolveMarketingCronHermesTimeoutMs,
} from "@/lib/marketing/cron/hermesSpawnFailure";
import { spawnSync } from "node:child_process";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { ensureSharedObservabilityRecorder } from "@/ai-runtime/observability/persistence";
import { createDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_edit"),
    titleKo: z.string().optional(),
    dekKo: z.string().nullable().optional(),
    openingHookKo: z.string().optional(),
    bodyKo: z.string().optional(),
    keyTakeawaysKo: z.array(z.string()).optional(),
    decisionGuidanceKo: z.string().optional(),
    optionalCtaIntentKo: z.string().nullable().optional(),
    limitationsKo: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("approve_original"),
  }),
  z.object({
    action: z.literal("approve_edited"),
  }),
]);

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Canonical Marketing Asset — human edit / approve before channel generation.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail?.candidate) {
      return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    }
    const runRepo = await createDailyMarketingRunRepository({});

    if (parsed.data.action === "save_edit") {
      const { candidate, asset } = await saveCanonicalAssetHumanEdit({
        candidate: detail.candidate,
        runRepo,
        edits: {
          titleKo: parsed.data.titleKo,
          dekKo: parsed.data.dekKo,
          openingHookKo: parsed.data.openingHookKo,
          bodyKo: parsed.data.bodyKo,
          keyTakeawaysKo: parsed.data.keyTakeawaysKo,
          decisionGuidanceKo: parsed.data.decisionGuidanceKo,
          optionalCtaIntentKo: parsed.data.optionalCtaIntentKo,
          limitationsKo: parsed.data.limitationsKo,
        },
      });
      return Response.json({
        ok: true,
        action: "save_edit",
        message: "수정본을 저장했습니다.",
        asset: {
          assetId: asset.assetId,
          version: asset.version,
          status: asset.status,
          statusLabelKo: "수정됨",
        },
        candidateId: candidate.candidateId,
      });
    }

    const useRuntime = isAiRuntimeMarketingCronEnabled();
    if (useRuntime) {
      await ensureSharedObservabilityRecorder();
    }
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    const invoke = createPublishableComposerInvoke({
      useRuntime,
      correlationId: createMarketingCronCorrelationId(),
      executor: useRuntime ? createRuntimeExecutorStack() : undefined,
      completionTimeoutMs: timeoutMs,
      invokeHermesProfile: useRuntime
        ? undefined
        : (profile, prompt) => {
            const hermesBin = resolveHermesExecutable(process.env);
            const result = spawnSync(
              hermesBin,
              ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt],
              {
                encoding: "utf8",
                env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
                timeout: timeoutMs,
              },
            );
            return assertHermesSpawnSyncSuccess(profile, result, timeoutMs);
          },
    });
    if (!invoke) {
      return Response.json(
        { message: "채널 생성용 LLM invoke를 사용할 수 없습니다." },
        { status: 503 },
      );
    }

    const mode =
      parsed.data.action === "approve_original" ? "ai_original" : "human_edited";
    const result = await approveCanonicalAssetAndGenerateChannels({
      candidate: detail.candidate,
      runRepo,
      mode,
      approvedBy: auth.session.username ?? auth.session.adminUserId ?? "human",
      invoke,
      review: detail.review,
    });

    return Response.json({
      ok: true,
      action: parsed.data.action,
      message:
        mode === "ai_original"
          ? "AI 원본을 승인했고 채널 콘텐츠 제작을 시작했습니다."
          : "수정본을 승인했고 채널 콘텐츠 제작을 시작했습니다.",
      asset: {
        assetId: result.asset.assetId,
        version: result.asset.version,
        approvedVersion: result.asset.approvedVersion,
        status: result.asset.status,
        statusLabelKo: "승인됨",
      },
      sourceAssetVersion: result.bundle.sourceAssetVersion,
      targetChannels: result.bundle.targetChannels,
      staleChannels: result.staleChannels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "canonical_asset_missing") {
      return Response.json({ message: "공통 마케팅 원문이 없습니다." }, { status: 404 });
    }
    if (message === "validation_failed_asset_cannot_approve") {
      return Response.json(
        { message: "검증에 실패한 원문은 승인할 수 없습니다." },
        { status: 409 },
      );
    }
    if (message === "use_approve_edited_for_human_edited_asset") {
      return Response.json(
        { message: "수정본이 있습니다. 「수정본 승인」을 사용하세요." },
        { status: 409 },
      );
    }
    if (message === "human_edited_approval_requires_edit") {
      return Response.json(
        { message: "수정본이 없어 「수정본 승인」을 할 수 없습니다." },
        { status: 409 },
      );
    }
    return humanReviewErrorResponse(error);
  }
}
