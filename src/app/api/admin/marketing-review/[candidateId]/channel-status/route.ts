import { requireAdminPermission } from "@/lib/apiAuth";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import {
  setChannelReviewStatusBatchSchema,
  setChannelReviewStatusSchema,
} from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * CG-4C — approve / skip / reset channels.
 *
 * Accepts a single `channel` or a `channels` array. In the batch form each
 * channel keeps its own gate, so one blocked channel reports a failure without
 * discarding the channels that did pass.
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

  const single = setChannelReviewStatusSchema.safeParse(body);
  const batch = single.success ? null : setChannelReviewStatusBatchSchema.safeParse(body);
  if (!single.success && !batch?.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  const payload = single.success ? single.data : batch!.data!;
  const channels = single.success ? [single.data.channel] : batch!.data!.channels;
  const reviewedBy = auth.session.username ?? auth.session.adminUserId ?? null;

  try {
    const service = await createHumanMarketingReviewService();

    if (single.success) {
      const review = await service.setChannelReviewStatus({
        candidateId,
        channel: single.data.channel,
        status: single.data.status,
        notes: single.data.notes,
        humanNotes: single.data.humanNotes,
        reviewedBy,
      });
      return Response.json({ review });
    }

    let review: HumanMarketingReview | null = null;
    const results: Array<{ channel: string; ok: boolean; message?: string }> = [];
    for (const channel of channels) {
      try {
        review = await service.setChannelReviewStatus({
          candidateId,
          channel,
          status: payload.status,
          notes: payload.notes,
          humanNotes: payload.humanNotes,
          reviewedBy,
        });
        results.push({ channel, ok: true });
      } catch (error) {
        results.push({
          channel,
          ok: false,
          message: error instanceof Error ? error.message : "channel_status_failed",
        });
      }
    }

    const applied = results.filter((item) => item.ok).length;
    // Nothing applied means the caller's whole intent failed — surface the first cause.
    if (applied === 0) {
      return Response.json(
        { message: results[0]?.message ?? "channel_status_failed", results },
        { status: 409 },
      );
    }
    return Response.json({ review, applied, results });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
