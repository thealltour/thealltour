import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateActionSchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slateItemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { slateItemId } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = agendaSlateActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const slate = await service.applyAction({
      slateItemId: decodeURIComponent(slateItemId),
      action: parsed.data.action,
      businessDateKst: parsed.data.businessDateKst,
    });
    const selectedTodayCount = slate.candidates.filter((c) => c.state === "SELECTED_TODAY").length;
    return Response.json({
      slate,
      selectedTodayCount,
      maxSelectedToday: MAX_SELECTED_TODAY,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
