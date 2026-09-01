import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { updateHumanDraftSchema } from "@/lib/marketing/review/validation";

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
    const review = await service.updateHumanDraft({
      candidateId,
      draft: {
        title: parsed.data.draft.title ?? null,
        body: parsed.data.draft.body,
        channel: parsed.data.draft.channel ?? "threads",
      },
      humanNotes: parsed.data.humanNotes,
      reviewedBy: auth.session.username ?? auth.session.adminUserId,
    });
    return Response.json({ review });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
