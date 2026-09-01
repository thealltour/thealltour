import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { deferHumanReviewSchema } from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = deferHumanReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const review = await service.deferHumanReview({
      candidateId,
      humanNotes: parsed.data.humanNotes,
      deferredUntil: parsed.data.deferredUntil,
      reviewedBy: auth.session.username ?? auth.session.adminUserId,
    });
    return Response.json({ review });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
