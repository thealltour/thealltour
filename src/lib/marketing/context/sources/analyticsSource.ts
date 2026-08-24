import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiFeedbackRow } from "@/lib/marketing/context/mappers/performanceMapper";
import type { AiPublicationRow } from "@/lib/marketing/context/mappers/publicationContextMapper";

export async function fetchAiPublicationRows(input: {
  channel?: string;
  contentId?: string;
  contentIds?: string[];
  status?: string;
  periodStart: string;
  periodEnd?: string;
  limit?: number;
}): Promise<AiPublicationRow[]> {
  if (input.contentIds && input.contentIds.length === 0) return [];

  let query = supabaseAdmin
    .from("ai_publications")
    .select(
      "id, content_id, channel, external_post_id, external_url, status, scheduled_at, published_at, last_checked_at",
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? 200);

  if (input.periodEnd) {
    query = query.or(
      `and(published_at.gte.${input.periodStart},published_at.lte.${input.periodEnd}),and(published_at.is.null,scheduled_at.gte.${input.periodStart},scheduled_at.lte.${input.periodEnd})`,
    );
  } else {
    query = query.or(`published_at.gte.${input.periodStart},scheduled_at.gte.${input.periodStart}`);
  }
  if (input.channel) query = query.eq("channel", input.channel);
  if (input.contentId) query = query.eq("content_id", input.contentId);
  else if (input.contentIds?.length) query = query.in("content_id", input.contentIds);
  if (input.status) query = query.eq("status", input.status);

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_publications lookup failed: ${error.message}`);
  }
  return (data as AiPublicationRow[] | null) ?? [];
}

export async function fetchAiFeedbackRows(input: {
  channel?: string;
  publicationIds?: string[];
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<AiFeedbackRow[]> {
  if (input.publicationIds && input.publicationIds.length === 0) return [];

  let query = supabaseAdmin
    .from("ai_feedback")
    .select("publication_id, channel, metric_type, metric_value, measured_at")
    .gte("measured_at", input.periodStart)
    .lte("measured_at", input.periodEnd)
    .order("measured_at", { ascending: false })
    .limit(input.limit ?? 500);

  if (input.channel) {
    query = query.eq("channel", input.channel);
  }
  if (input.publicationIds?.length) {
    query = query.in("publication_id", input.publicationIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_feedback lookup failed: ${error.message}`);
  }
  return (data as AiFeedbackRow[] | null) ?? [];
}
