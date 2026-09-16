import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { z } from "zod";
import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { ensurePackageLayout, resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { mkdirSync, existsSync } from "node:fs";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
import { mergeChannelReviewsFromPublishable } from "@/lib/marketing/review/mergeChannelReviews";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import {
  createMarketingCronCorrelationId,
  createPublishableComposerInvoke,
  isAiRuntimeMarketingCronEnabled,
} from "@/lib/marketing/cron/marketingCronRuntime";
import { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } from "@/lib/marketing/cron/marketingPlanSpecialists";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { ensureSharedObservabilityRecorder } from "@/ai-runtime/observability/persistence";
import {
  attachCanonicalAssetToCandidate,
  readCanonicalAssetFromPackage,
} from "@/lib/marketing/canonicalAsset/persistence";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";

export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["threads", "naver_blog", "naver_band", "kakao_channel"]),
  allowOverwriteHuman: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * CG-4C / MQ-4 — channel-scoped regenerate via LLM composer (no RA-1 web search).
 * Shortform regenerate intentionally not exposed here.
 * Requires an approved Canonical Marketing Asset (package SoT).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail?.candidate) throw new Error("candidate_not_found");
    const review = detail.review;
    if (!review) throw new Error("review_missing");

    const entry = review.channelReviews?.[parsed.data.channel];
    if (entry?.humanDraft?.body && !parsed.data.allowOverwriteHuman) {
      return Response.json(
        { message: "human_edited_channel_requires_confirm", channel: parsed.data.channel },
        { status: 409 },
      );
    }

    const assetRoot = resolveMarketingAssetRoot({});
    const packageRoot = resolvePackageDirectory({
      assetRoot,
      businessDateKst: detail.candidate.businessDateKst,
      candidateId,
    });
    if (!existsSync(packageRoot)) {
      mkdirSync(packageRoot, { recursive: true });
      ensurePackageLayout(packageRoot);
    }

    const packageAsset = readCanonicalAssetFromPackage(packageRoot);
    if (packageAsset && !isApprovedCanonicalAsset(packageAsset)) {
      return Response.json(
        {
          message: "공통 마케팅 원문이 아직 승인되지 않았습니다. 수정본/원문 승인 후 채널을 생성하세요.",
          code: "canonical_asset_unapproved",
        },
        { status: 409 },
      );
    }
    const approvedAsset =
      packageAsset && isApprovedCanonicalAsset(packageAsset) ? packageAsset : null;
    const candidate = approvedAsset
      ? attachCanonicalAssetToCandidate(detail.candidate, approvedAsset)
      : detail.candidate;

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
        : (profile, prompt) => invokeHermesProfileAsync(profile, prompt, timeoutMs),
    });

    if (!invoke) {
      return Response.json(
        { message: "publishable_llm_invoke_unavailable" },
        { status: 503 },
      );
    }

    const bundle = await ensurePublishableContent({
      candidate,
      packageRoot,
      forceRegenerateChannels: [parsed.data.channel as PublishableChannel],
      allowOverwriteHuman: Boolean(parsed.data.allowOverwriteHuman),
      explicitTargetChannels: [
        ...(detail.candidate.contentPlan?.targetChannels ?? ["threads", "shortform"]),
        parsed.data.channel as PublishableChannel,
      ],
      audienceContentResearchBrief: null,
      approvedCanonicalAsset: approvedAsset,
      invoke,
      persist: true,
    });

    const merged = mergeChannelReviewsFromPublishable({
      existing: {
        ...(review.channelReviews ?? {}),
        [parsed.data.channel]: entry
          ? {
              ...entry,
              humanDraft: parsed.data.allowOverwriteHuman ? null : entry.humanDraft,
              status: "needs_review",
              aiDraft: entry.aiDraft,
            }
          : undefined,
      },
      bundle,
    });

    const slot =
      parsed.data.channel === "threads"
        ? bundle.threads
        : parsed.data.channel === "naver_blog"
          ? bundle.naver_blog
          : parsed.data.channel === "naver_band"
            ? bundle.naver_band
            : bundle.kakao_channel;
    if (slot?.body) {
      merged[parsed.data.channel] = {
        channel: parsed.data.channel,
        status: "needs_review",
        aiDraft: { title: slot.title, body: slot.body },
        humanDraft: parsed.data.allowOverwriteHuman ? null : entry?.humanDraft ?? null,
        validationWarnings: slot.validation.ok
          ? slot.publishableSuccess === false
            ? ["degraded:needs_regeneration"]
            : []
          : slot.validation.issues.map((i) => i.message).slice(0, 8),
        lastEditedAt: entry?.lastEditedAt ?? null,
        approvedAt: null,
        skippedAt: null,
        notes: entry?.notes ?? null,
      };
    }

    const { createHumanMarketingReviewRepository } = await import(
      "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
    );
    const repo = await createHumanMarketingReviewRepository();
    const updated = await repo.update({
      ...review,
      channelReviews: merged,
      updatedAt: new Date().toISOString(),
    });

    return Response.json({
      review: updated,
      regeneratedChannel: parsed.data.channel,
      externalResearchCalls: 0,
      composer: slot?.provenance.composer ?? null,
      publishableSuccess: slot?.publishableSuccess ?? false,
      status: slot?.status ?? null,
      sourceAssetVersion: bundle.sourceAssetVersion ?? approvedAsset?.approvedVersion ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "canonical_asset_unapproved") {
      return Response.json(
        {
          message: "공통 마케팅 원문이 아직 승인되지 않았습니다. 수정본/원문 승인 후 채널을 생성하세요.",
          code: "canonical_asset_unapproved",
        },
        { status: 409 },
      );
    }
    return humanReviewErrorResponse(error);
  }
}
