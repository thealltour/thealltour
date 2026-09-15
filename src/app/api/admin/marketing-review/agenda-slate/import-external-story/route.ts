import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateImportExternalStorySchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const dynamic = "force-dynamic";

/**
 * Import ChatGPT (or future API) external-editorial-director-v1 JSON into Story Selection.
 * Does not call OpenAI and does not start RA-1.
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
  const parsed = agendaSlateImportExternalStorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const result = await service.importExternalEditorialStories({
      businessDateKst: parsed.data.businessDateKst,
      rawJson: parsed.data.rawJson,
      dryRun: parsed.data.dryRun,
    });
    const selectedTodayCount =
      result.slate?.candidates.filter((c) => c.state === "SELECTED_TODAY").length ?? 0;
    return Response.json({
      slate: result.slate,
      request: result.request,
      dryRun: result.dryRun,
      preview: result.preview,
      selectedTodayCount,
      maxSelectedToday: MAX_SELECTED_TODAY,
      executedProduction: false,
      message: result.dryRun
        ? `검증 OK — ${result.preview.storyCountAccepted}개 Story 미리보기`
        : `외부 Story ${result.preview.storyCountAccepted}개를 가져왔습니다. 아직 연구/제작은 시작하지 않았습니다.`,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
