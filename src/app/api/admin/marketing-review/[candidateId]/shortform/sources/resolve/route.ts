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
 * Default: reuse durable package resolution when present (CG-2).
 * Body `{ "forceRefresh": true }` re-runs providers (Admin “소스 검색”).
 * Body `{ "persistedOnly": true }` never calls providers.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let forceRefresh = false;
  let persistedOnly = false;
  try {
    const body = (await request.json()) as { forceRefresh?: unknown; persistedOnly?: unknown };
    forceRefresh = body?.forceRefresh === true;
    persistedOnly = !forceRefresh && body?.persistedOnly === true;
  } catch {
    forceRefresh = false;
  }

  try {
    const dto = await resolveShortformSourcesForReview({ candidateId, forceRefresh, persistedOnly });
    return Response.json(dto, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return shortformSourceReviewErrorResponse(error);
  }
}
