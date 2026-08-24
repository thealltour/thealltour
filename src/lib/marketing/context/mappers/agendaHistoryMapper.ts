import { asInteger, asString } from "@/lib/marketing/context/json";
import type { AgendaHistoryItem } from "@/lib/marketing/context/types";

export type AiAgendaRow = {
  id?: unknown;
  campaign_id?: unknown;
  topic?: unknown;
  agenda_key?: unknown;
  last_used_at?: unknown;
  usage_count?: unknown;
  created_at?: unknown;
};

export function mapAiAgendaRow(row: AiAgendaRow): AgendaHistoryItem | null {
  const id = asString(row.id);
  const topic = asString(row.topic);
  const agendaKey = asString(row.agenda_key);
  if (!id || !topic || !agendaKey) return null;
  return {
    id,
    campaignId: asString(row.campaign_id),
    topic,
    agendaKey,
    lastUsedAt: asString(row.last_used_at),
    usageCount: asInteger(row.usage_count) ?? 0,
    createdAt: asString(row.created_at),
  };
}
