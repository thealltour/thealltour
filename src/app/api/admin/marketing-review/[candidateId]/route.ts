import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail) {
      return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    }
    await service.getOrCreateHumanReview(candidateId, auth.session.username ?? auth.session.adminUserId);
    const refreshed = await service.getHumanReviewDetail(candidateId);
    return Response.json(refreshed, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
