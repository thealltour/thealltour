import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiAgendaRow } from "@/lib/marketing/context/mappers/agendaHistoryMapper";

export async function fetchAiAgendaRows(input: {
  campaignId?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
}): Promise<AiAgendaRow[]> {
  let query = supabaseAdmin
    .from("ai_agendas")
    .select("id, campaign_id, topic, agenda_key, last_used_at, usage_count, created_at")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? 50);

  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
  if (input.periodStart) query = query.gte("created_at", input.periodStart);
  if (input.periodEnd) query = query.lte("created_at", input.periodEnd);

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_agendas lookup failed: ${error.message}`);
  }
  return (data as AiAgendaRow[] | null) ?? [];
}
