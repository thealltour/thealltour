import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateProductionRequestSchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const dynamic = "force-dynamic";

/**
 * Persist durable production request(s) for SELECTED_TODAY items.
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
  const parsed = agendaSlateProductionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const result = await service.requestProductionForSelected({
      businessDateKst: parsed.data.businessDateKst,
      slateItemIds: parsed.data.slateItemIds,
    });
    return Response.json({
      slate: result.slate,
      requests: result.requests,
      createdCount: result.createdCount,
      selectedTodayCount: result.slate.candidates.filter((c) => c.state === "SELECTED_TODAY").length,
      maxSelectedToday: MAX_SELECTED_TODAY,
      executedProduction: false,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
