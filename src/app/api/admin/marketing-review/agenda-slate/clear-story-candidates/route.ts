import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { agendaSlateClearStoryCandidatesSchema } from "@/lib/marketing/cron/daily/agendaSlate/validation";

export const dynamic = "force-dynamic";

/**
 * Wipe every Story candidate (internal Story Miner + external imports) for one slate item,
 * or for all resettable items of the day. Finished or running productions are never touched.
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
  const parsed = agendaSlateClearStoryCandidatesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const result = await service.clearStoryCandidates({
      businessDateKst: parsed.data.businessDateKst,
      slateItemId: parsed.data.slateItemId,
      all: parsed.data.all,
    });
    const removed = result.cleared.reduce((sum, c) => sum + c.removedCount, 0);
    const skippedNote = result.skipped.length > 0 ? ` · 건너뜀 ${result.skipped.length}건` : "";
    return Response.json({
      slate: result.slate,
      cleared: result.cleared,
      skipped: result.skipped,
      message: `아젠다 ${result.cleared.length}건에서 Story 후보 ${removed}개를 지웠습니다${skippedNote}.`,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
