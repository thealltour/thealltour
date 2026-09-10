import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateRetryProductionSchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const dynamic = "force-dynamic";

/**
 * Re-open a FAILED production request as QUEUED (same logical_run_key).
 * Does NOT execute the AI production pipeline in this browser request.
 */
export async function POST(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = agendaSlateRetryProductionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const result = await service.retryFailedProduction({
      businessDateKst: parsed.data.businessDateKst,
      slateItemId: parsed.data.slateItemId,
      logicalRunKey: parsed.data.logicalRunKey,
    });
    const selectedTodayCount =
      result.slate?.candidates.filter((c) => c.state === "SELECTED_TODAY").length ?? 0;
    return Response.json({
      slate: result.slate,
      request: result.request,
      selectedTodayCount,
      maxSelectedToday: MAX_SELECTED_TODAY,
      executedProduction: false,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
