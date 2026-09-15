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
});

/**
 * Build ChatGPT-ready Editorial Director clipboard text for the full daily slate.
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
    });
    return Response.json({
      text: result.text,
      agendaCount: result.agendaCount,
      slateId: result.slate.slateId,
      businessDateKst: result.slate.businessDateKst,
      message: `오늘 Slate ${result.agendaCount}건이 포함되었습니다.`,
    });
  } catch (error) {
    return agendaSlateErrorResponse(error);
  }
}
