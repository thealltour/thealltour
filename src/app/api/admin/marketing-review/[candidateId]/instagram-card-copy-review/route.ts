import { requireAdminPermission } from "@/lib/apiAuth";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { instagramCardCopyReviewActionSchema } from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ candidateId: string }> };

/** Instagram card-by-card human review (gate for VRA / SVP / cardnews render). */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const service = await createHumanMarketingReviewService();
    const view = await service.getInstagramCardCopyReview(candidateId);
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}

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
  const parsed = instagramCardCopyReviewActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  const reviewedBy = auth.session.username ?? auth.session.adminUserId ?? null;
  try {
    const service = await createHumanMarketingReviewService();
    const view =
      parsed.data.action === "save"
        ? await service.saveInstagramCardCopyReview({
            candidateId,
            cards: parsed.data.cards,
            reviewedBy,
          })
        : parsed.data.action === "approve"
          ? await service.approveInstagramCardCopyReview({
              candidateId,
              reviewedBy,
              keepExistingVisuals: parsed.data.keepExistingVisuals ?? false,
            })
          : await service.resetInstagramCardCopyReview({ candidateId, reviewedBy });
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
