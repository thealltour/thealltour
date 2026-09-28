import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateReleaseSelectionSchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";

export const dynamic = "force-dynamic";

/** Unselect every "오늘 제작" item of the day. Queued/running productions are not cancelled. */
export async function POST(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = agendaSlateReleaseSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const businessDateKst = parsed.data.businessDateKst;
    const releasableIds = new Set(
      ((await service.getTodaySlate(businessDateKst))?.candidates ?? [])
        .filter((c) => c.state === "SELECTED_TODAY")
        .map((c) => c.slateItemId),
    );
    const result = await service.releaseAllSelected({ businessDateKst });
    const activeCount = (await service.listProductionRequests(businessDateKst)).filter(
      (r) => releasableIds.has(r.slateItemId) && (r.status === "QUEUED" || r.status === "RUNNING"),
    ).length;
    const activeNote =
      activeCount > 0 ? ` 이미 대기열·실행 중인 제작 ${activeCount}건은 취소되지 않고 계속 진행됩니다.` : "";
    const selectedTodayCount = result.slate.candidates.filter((c) => c.state === "SELECTED_TODAY").length;
    return Response.json({
      slate: result.slate,
      selectedTodayCount,
      releasedCount: result.releasedCount,
      message:
        result.releasedCount > 0
          ? `선택 ${result.releasedCount}건을 해제했습니다.${activeNote}`
          : "해제할 선택이 없습니다.",
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
