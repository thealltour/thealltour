import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiPublicationRow } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { fetchAiPublicationRows } from "@/lib/marketing/context/sources/analyticsSource";

export async function fetchPublicationHistoryRows(input: {
  channel?: string;
  contentId?: string;
  contentIds?: string[];
  status?: string;
  periodStart: string;
  periodEnd?: string;
  limit?: number;
}): Promise<AiPublicationRow[]> {
  return fetchAiPublicationRows(input);
}

export async function fetchPublicationRowById(id: string): Promise<AiPublicationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_publications")
    .select(
      "id, content_id, channel, external_post_id, external_url, status, scheduled_at, published_at, last_checked_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`ai_publications lookup failed: ${error.message}`);
  }
  return (data as AiPublicationRow | null) ?? null;
}
