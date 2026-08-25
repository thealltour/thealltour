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
  ids?: string[];
  productId?: string;
  productIds?: string[];
  campaignId?: string;
  agendaId?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
}): Promise<AiContentRow[]> {
  if (input.ids && input.ids.length === 0) return [];
  const productIds = [
    ...new Set([
      ...(input.productId ? [input.productId] : []),
      ...(input.productIds ?? []),
    ]),
  ];

  let query = supabaseAdmin
    .from("ai_contents")
    .select("id, campaign_id, agenda_id, primary_product_id, title, body, hook, cta, created_at, content_type, status")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.ids?.length) query = query.in("id", input.ids);
  if (productIds.length === 1) query = query.eq("primary_product_id", productIds[0]);
  else if (productIds.length > 1) query = query.in("primary_product_id", productIds);
  if (input.campaignId) {
    query = query.eq("campaign_id", input.campaignId);
  }
  if (input.agendaId) {
    query = query.eq("agenda_id", input.agendaId);
  }
  if (input.periodStart) query = query.gte("created_at", input.periodStart);
  if (input.periodEnd) query = query.lte("created_at", input.periodEnd);

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_contents lookup failed: ${error.message}`);
  }
  return (data as AiContentRow[] | null) ?? [];
}
