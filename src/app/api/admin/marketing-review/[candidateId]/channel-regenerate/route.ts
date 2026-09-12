import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { z } from "zod";
import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { mergeChannelReviewsFromPublishable } from "@/lib/marketing/review/mergeChannelReviews";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["threads", "naver_blog", "naver_band", "kakao_channel"]),
  allowOverwriteHuman: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * CG-4C — channel-scoped regenerate (deterministic, no RA-1 web search).
 * Shortform regenerate intentionally not exposed here.
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

    const bundle = ensurePublishableContentSync({
      candidate: detail.candidate,
      packageRoot,
      forceRegenerateChannels: [parsed.data.channel as PublishableChannel],
      explicitTargetChannels: [
        ...(detail.candidate.contentPlan?.targetChannels ?? ["threads", "shortform"]),
        parsed.data.channel as PublishableChannel,
      ],
      audienceContentResearchBrief: null,
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

    // Force AI draft refresh for regenerated channel
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
          ? []
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
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
