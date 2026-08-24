import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiContentRow, ThreadMarketingPostRow } from "@/lib/marketing/context/mappers/contentHistoryMapper";

export async function fetchThreadMarketingPostRows(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<ThreadMarketingPostRow[]> {
  let query = supabaseAdmin
    .from("thread_marketing_posts")
    .select("id, product_id, published_at, created_at, permalink, target_keyword, media_id")
    .gte("published_at", input.periodStart)
    .lte("published_at", input.periodEnd)
    .order("published_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.productId) {
    query = query.eq("product_id", input.productId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`thread_marketing_posts lookup failed: ${error.message}`);
  }
  return (data as ThreadMarketingPostRow[] | null) ?? [];
}

export async function fetchAiContentRows(input: {
  productId?: string;
  campaignId?: string;
  agendaId?: string;
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<AiContentRow[]> {
  let query = supabaseAdmin
    .from("ai_contents")
    .select("id, campaign_id, agenda_id, primary_product_id, title, body, hook, created_at, content_type, status")
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.productId) {
    query = query.eq("primary_product_id", input.productId);
  }
  if (input.campaignId) {
    query = query.eq("campaign_id", input.campaignId);
  }
  if (input.agendaId) {
    query = query.eq("agenda_id", input.agendaId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_contents lookup failed: ${error.message}`);
  }
  return (data as AiContentRow[] | null) ?? [];
}
