import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import {
  createManualPublicationFollowUpDeps,
  runManualPublicationFollowUp,
  type ManualPublicationFollowUpStep,
} from "@/lib/marketing/review/manualPublicationFollowUp";
import { markManuallyPublishedSchema } from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

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
  const parsed = markManuallyPublishedSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  const reviewedBy = auth.session.username ?? auth.session.adminUserId ?? null;

  try {
    const service = await createHumanMarketingReviewService();
    const review = await service.markManuallyPublished({
      candidateId,
      manualPublication: parsed.data.manualPublication,
      humanNotes: parsed.data.humanNotes,
      reviewedBy,
    });

    /**
     * The transition is already committed. Record the SocialPublication bridge
     * entry and a performance snapshot so the 08:30 brief sees real metrics —
     * but never let either failure surface as a failed publication record.
     */
    let followUpSteps: ManualPublicationFollowUpStep[] = [];
    let followUpReview = review;
    try {
      const deps = await createManualPublicationFollowUpDeps({
        humanNotes: parsed.data.humanNotes,
        reviewedBy,
      });
      const followUp = await runManualPublicationFollowUp({
        candidateId,
        review,
        humanNotes: parsed.data.humanNotes,
        reviewedBy,
        deps,
      });
      followUpSteps = followUp.steps;
      followUpReview = followUp.review;
    } catch (error) {
      followUpSteps = [
        {
          step: "publication_bridge",
          status: "failed",
          reason: error instanceof Error ? error.message : "follow_up_unavailable",
          ref: null,
        },
      ];
    }

    return Response.json({ review: followUpReview, followUp: followUpSteps });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
