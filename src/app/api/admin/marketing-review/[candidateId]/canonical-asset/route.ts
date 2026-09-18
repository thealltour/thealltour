import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import {
  approveCanonicalAsset,
  saveCanonicalAssetHumanEdit,
} from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import { regenerateCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/regenerateCanonicalMarketingAsset";
import {
  formatCanonicalAssetValidationIssuesKo,
  STALE_ASSET_MESSAGE_KO,
} from "@/lib/marketing/canonicalAsset/chatGptAssetTransfer";
import type { CanonicalAssetValidationIssue } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  createAssetSourceWriterInvoke,
  createMarketingCronCorrelationId,
  createPublishableComposerInvoke,
  isAiRuntimeMarketingCronEnabled,
} from "@/lib/marketing/cron/marketingCronRuntime";
import { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } from "@/lib/marketing/cron/marketingPlanSpecialists";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { ensureSharedObservabilityRecorder } from "@/ai-runtime/observability/persistence";
import { createDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";

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
    expectedAssetId: z.string().optional(),
    expectedVersion: z.number().int().positive().optional(),
    expectedSourceRevision: z.string().optional(),
    /** ChatGPT import — force domain validation before persist. */
    fromChatGptImport: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("approve_original"),
  }),
  z.object({
    action: z.literal("approve_edited"),
  }),
  z.object({
    action: z.literal("regenerate"),
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
      const fromChatGpt = Boolean(parsed.data.fromChatGptImport);
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
          // ChatGPT import must never overwrite limitations; only manual save may.
          limitationsKo: fromChatGpt ? undefined : parsed.data.limitationsKo,
        },
        expectedAssetId: parsed.data.expectedAssetId,
        expectedVersion: parsed.data.expectedVersion,
        expectedSourceRevision: parsed.data.expectedSourceRevision,
        requireDomainValidation: fromChatGpt,
      });
      return Response.json({
        ok: true,
        action: "save_edit",
        message: fromChatGpt
          ? "검증된 수정본을 저장했습니다."
          : "수정본을 저장했습니다.",
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

    if (parsed.data.action === "regenerate") {
      const aswInvoke =
        createAssetSourceWriterInvoke({
          useRuntime,
          correlationId: createMarketingCronCorrelationId(),
          executor: useRuntime ? createRuntimeExecutorStack() : undefined,
          completionTimeoutMs: timeoutMs,
          invokeHermesProfile: useRuntime
            ? undefined
            : (profile, prompt) => invokeHermesProfileAsync(profile, prompt, timeoutMs),
        }) ??
        createPublishableComposerInvoke({
          useRuntime,
          correlationId: createMarketingCronCorrelationId(),
          executor: useRuntime ? createRuntimeExecutorStack() : undefined,
          completionTimeoutMs: timeoutMs,
          invokeHermesProfile: useRuntime
            ? undefined
            : (profile, prompt) => invokeHermesProfileAsync(profile, prompt, timeoutMs),
        });
      if (!aswInvoke) {
        return Response.json(
          { message: "Asset Source Writer invoke를 사용할 수 없습니다." },
          { status: 503 },
        );
      }
      const prodRepo = await createMarketingProductionRequestRepository({});
      const productionRequest = detail.candidate.logicalRunKey
        ? await prodRepo.findByLogicalKey(detail.candidate.logicalRunKey)
        : null;
      const result = await regenerateCanonicalMarketingAsset({
        candidate: detail.candidate,
        runRepo,
        invoke: aswInvoke,
        productionRequest,
      });
      return Response.json({
        ok: true,
        action: "regenerate",
        message: "공통 원문을 새 Asset Source Writer 프롬프트로 다시 작성했습니다.",
        asset: {
          assetId: result.asset.assetId,
          version: result.asset.version,
          status: result.asset.status,
          statusLabelKo: "초안",
          titleKo: result.asset.titleKo,
          sourceRevision: result.asset.sourceRevision,
        },
        outcome: result.ensure.outcome,
        llmCallCount: result.ensure.llmCallCount,
        editorialArchetype: result.ensure.writerInput.editorialArchetype,
        candidateId: result.candidate.candidateId,
      });
    }

    const mode =
      parsed.data.action === "approve_original" ? "ai_original" : "human_edited";
    const result = await approveCanonicalAsset({
      candidate: detail.candidate,
      runRepo,
      mode,
      approvedBy: auth.session.username ?? auth.session.adminUserId ?? "human",
      review: detail.review,
    });

    return Response.json({
      ok: true,
      action: parsed.data.action,
      message:
        mode === "ai_original"
          ? "AI 원본을 승인했습니다. 채널 탭에서 원하는 채널만 생성하세요."
          : "수정본을 승인했습니다. 채널 탭에서 원하는 채널만 생성하세요.",
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
      channelsAutoGenerated: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "canonical_asset_missing") {
      return Response.json({ message: "공통 마케팅 원문이 없습니다." }, { status: 404 });
    }
    if (message === "canonical_asset_stale") {
      return Response.json(
        {
          message: STALE_ASSET_MESSAGE_KO,
          code: "stale",
        },
        { status: 409 },
      );
    }
    if (message === "canonical_asset_validation_failed") {
      const issues =
        error && typeof error === "object" && "issues" in error
          ? ((error as { issues?: CanonicalAssetValidationIssue[] }).issues ?? [])
          : [];
      return Response.json(
        {
          message: formatCanonicalAssetValidationIssuesKo(issues),
          code: "validation_failed",
          issues,
        },
        { status: 422 },
      );
    }
    if (message === "canonical_asset_validation_context_missing") {
      return Response.json(
        {
          message:
            "Story/Evidence/Proposition 컨텍스트가 없어 원문을 재작성할 수 없습니다.",
          code: "validation_context_missing",
        },
        { status: 422 },
      );
    }
    if (message === "canonical_asset_regenerate_failed") {
      return Response.json(
        {
          message: "공통 원문 재작성에 실패했습니다.",
          code: "regenerate_failed",
        },
        { status: 502 },
      );
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
