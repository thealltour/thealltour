import { AgendaSlateServiceError } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";

export function agendaSlateErrorResponse(error: unknown): Response {
  if (error instanceof AgendaSlateServiceError) {
    return Response.json({ message: error.message, code: error.code }, { status: error.status });
  }
  console.error("[agenda-slate]", error);
  return Response.json({ message: "internal error" }, { status: 500 });
}
