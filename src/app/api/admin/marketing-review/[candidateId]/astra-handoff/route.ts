import { requireAdminPermission } from "@/lib/apiAuth";
import {
  astraHandoffOperatorErrorResponse,
  getVisualOrchestrationOperatorView,
} from "@/lib/marketing/publishable/visualOrchestration/operatorService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * GET Shared Visual Plan + Manual Astra Handoff operator view (lifecycle-aware).
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const view = await getVisualOrchestrationOperatorView(candidateId);
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return astraHandoffOperatorErrorResponse(error);
  }
}
