import { requireAdminPermission } from "@/lib/apiAuth";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { shortformNarrationActionSchema } from "@/lib/marketing/review/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ candidateId: string }> };

/** Shortform narration segment review (media-brief is the render input). */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const service = await createHumanMarketingReviewService();
    const view = await service.getShortformNarration(candidateId);
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
  const parsed = shortformNarrationActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  const reviewedBy = auth.session.username ?? auth.session.adminUserId ?? null;
  try {
    const service = await createHumanMarketingReviewService();
    const result = await service.saveShortformNarration({
      candidateId,
      segments: parsed.data.segments,
      reviewedBy,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
