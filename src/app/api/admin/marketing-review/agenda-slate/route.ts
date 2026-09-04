import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  try {
    const url = new URL(request.url);
    const businessDateKst = url.searchParams.get("businessDateKst") ?? undefined;
    const service = await createAgendaSlateService();
    const [slate, productionRequests] = await Promise.all([
      service.getTodaySlate(businessDateKst),
      service.listProductionRequests(businessDateKst),
    ]);
    const selectedTodayCount =
      slate?.candidates.filter((c) => c.state === "SELECTED_TODAY").length ?? 0;
    return Response.json({
      slate,
      productionRequests,
      selectedTodayCount,
      maxSelectedToday: MAX_SELECTED_TODAY,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
