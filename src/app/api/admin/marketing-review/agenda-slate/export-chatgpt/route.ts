import { requireAdminPermission } from "@/lib/apiAuth";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import { agendaSlateErrorResponse } from "@/lib/marketing/cron/daily/agendaSlate/apiErrors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessDateKst: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  slateItemIds: z.array(z.string().min(1).max(80)).max(50).optional(),
});

/**
 * Build ChatGPT-ready Editorial Director clipboard text for the daily slate
 * (all agendas, or only the human-picked `slateItemIds`).
 * Does not call OpenAI — returns text for human paste.
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const service = await createAgendaSlateService();
    const result = await service.buildChatGptSlateExport({
      businessDateKst: parsed.data.businessDateKst,
      slateItemIds: parsed.data.slateItemIds,
    });
    const total = result.slate.candidates.length;
    return Response.json({
      text: result.text,
      agendaCount: result.agendaCount,
      totalCount: total,
      slateId: result.slate.slateId,
      businessDateKst: result.slate.businessDateKst,
      message:
        result.agendaCount < total
          ? `Slate ${total}건 중 선택한 ${result.agendaCount}건이 포함되었습니다.`
          : `오늘 Slate ${result.agendaCount}건이 포함되었습니다.`,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
