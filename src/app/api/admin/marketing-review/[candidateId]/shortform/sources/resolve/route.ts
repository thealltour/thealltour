import { requireAdminPermission } from "@/lib/apiAuth";
import {
  resolveShortformSourcesForReview,
  shortformSourceReviewErrorResponse,
} from "@/lib/marketing/assets/shortform/review/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Resolve shortform source candidates for human review.
 * Does not PICK, download binaries, or mutate Human Review approval.
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const dto = await resolveShortformSourcesForReview({ candidateId });
    return Response.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return shortformSourceReviewErrorResponse(error);
  }
}
