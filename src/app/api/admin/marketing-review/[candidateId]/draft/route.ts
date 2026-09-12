import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { updateHumanDraftSchema } from "@/lib/marketing/review/validation";
import { rebuildShortformBriefsFromDraft } from "@/lib/marketing/assets/shortform/rebuildShortformBriefsFromDraft";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid json" }, { status: 400 });
  }

  const parsed = updateHumanDraftSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const draft = {
      title: parsed.data.draft.title ?? null,
      body: parsed.data.draft.body,
      channel: parsed.data.draft.channel ?? "threads",
    };
    const review = await service.updateHumanDraft({
      candidateId,
      draft,
      humanNotes: parsed.data.humanNotes,
      reviewedBy: auth.session.username ?? auth.session.adminUserId ?? null,
    });

    // Best-effort: refresh shortform briefs from the saved draft (PICK usages kept).
    const briefRebuild = await rebuildShortformBriefsFromDraft({
      candidateId,
      draft,
      invalidateUnpickedResolution: true,
    }).catch(() => null);

    return Response.json({
      review,
      shortformBriefRebuild: briefRebuild?.ok
        ? {
            ok: true,
            sceneCount: briefRebuild.sceneCount,
            resolutionInvalidated: briefRebuild.resolutionInvalidated,
          }
        : briefRebuild
          ? { ok: false, reason: briefRebuild.reason }
          : null,
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
