import { mapAiAgendaRow } from "@/lib/marketing/context/mappers/agendaHistoryMapper";
import { fetchAiAgendaRows } from "@/lib/marketing/context/sources/agendaSource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { AgendaHistoryItem } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrieveAgendas(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<AgendaHistoryItem[]>> {
  const period = requireRetrievalPeriod(request);
  const rows = await fetchAiAgendaRows({
    campaignId: request.campaignId,
    periodStart: period.start,
    periodEnd: period.end,
    limit: request.limit,
  });

  return createRetrievalResult({
    data: rows.map(mapAiAgendaRow).filter((item): item is AgendaHistoryItem => item != null),
    sourceType: "agenda",
    sourceTable: "ai_agendas",
    sourceId: request.campaignId ?? request.agendaId,
    periodStart: period.start,
    periodEnd: period.end,
  });
}
