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
    const context = await service.getMorningMarketingReviewContext(candidateId);
    if (!context) {
      return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    }
    return Response.json(context, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
