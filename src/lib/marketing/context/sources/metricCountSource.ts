import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function fetchInquiryCount(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
  acquisitionChannel?: string;
}): Promise<number> {
  let query = supabaseAdmin
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd);
  if (input.productId) query = query.eq("product_id", input.productId);
  if (input.acquisitionChannel) query = query.eq("acquisition_channel", input.acquisitionChannel);
  const { count, error } = await query;
  if (error) throw new Error(`inquiries count failed: ${error.message}`);
  return count ?? 0;
}

export async function fetchBookingCount(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
  bookingStatus?: string;
}): Promise<number> {
  let query = supabaseAdmin
    .from("travel_bookings")
    .select("id", { count: "exact", head: true })
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd);
  if (input.productId) query = query.eq("product_id", input.productId);
  if (input.bookingStatus) query = query.eq("booking_status", input.bookingStatus);
  const { count, error } = await query;
  if (error) throw new Error(`travel_bookings count failed: ${error.message}`);
  return count ?? 0;
}

export async function fetchThreadMarketingPostCount(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  let query = supabaseAdmin
    .from("thread_marketing_posts")
    .select("id", { count: "exact", head: true })
    .gte("published_at", input.periodStart)
    .lte("published_at", input.periodEnd);
  if (input.productId) query = query.eq("product_id", input.productId);
  const { count, error } = await query;
  if (error) throw new Error(`thread_marketing_posts count failed: ${error.message}`);
  return count ?? 0;
}

export async function fetchAnalyticsEventNames(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<string[]> {
  let query = supabaseAdmin
    .from("analytics_events")
    .select("event_name")
    .gte("occurred_at", input.periodStart)
    .lte("occurred_at", input.periodEnd)
    .limit(input.limit ?? 100);
  if (input.productId) query = query.eq("product_id", input.productId);
  const { data, error } = await query;
  if (error) throw new Error(`analytics_events lookup failed: ${error.message}`);
  return (data ?? [])
    .map((row) => (typeof row.event_name === "string" ? row.event_name : null))
    .filter((name): name is string => Boolean(name));
}

export async function fetchKakaoMomentCreativeMetrics(input: {
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<Array<{ cost: number; impressions: number; clicks: number }>> {
  const { data, error } = await supabaseAdmin
    .from("kakao_moment_creatives")
    .select("cost, impressions, clicks, created_at")
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .limit(input.limit ?? 100);
  if (error) throw new Error(`kakao_moment_creatives lookup failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    cost: typeof row.cost === "number" ? row.cost : Number(row.cost) || 0,
    impressions: typeof row.impressions === "number" ? row.impressions : Number(row.impressions) || 0,
    clicks: typeof row.clicks === "number" ? row.clicks : Number(row.clicks) || 0,
  }));
}

export async function fetchAnalyticsEventCount(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  let query = supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .gte("occurred_at", input.periodStart)
    .lte("occurred_at", input.periodEnd);
  if (input.productId) query = query.eq("product_id", input.productId);
  const { count, error } = await query;
  if (error) throw new Error(`analytics_events count failed: ${error.message}`);
  return count ?? 0;
}

export async function fetchPublicationCount(input: {
  channel?: string;
  contentIds?: string[];
  status?: string;
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  if (input.contentIds && input.contentIds.length === 0) return 0;
  let query = supabaseAdmin
    .from("ai_publications")
    .select("id", { count: "exact", head: true })
    .or(
      `and(published_at.gte.${input.periodStart},published_at.lte.${input.periodEnd}),and(published_at.is.null,scheduled_at.gte.${input.periodStart},scheduled_at.lte.${input.periodEnd})`,
    );
  if (input.channel) query = query.eq("channel", input.channel);
  if (input.status) query = query.eq("status", input.status);
  if (input.contentIds?.length) query = query.in("content_id", input.contentIds);
  const { count, error } = await query;
  if (error) throw new Error(`ai_publications count failed: ${error.message}`);
  return count ?? 0;
}

export async function fetchAiContentIdsByProduct(
  productId: string,
  limit: number,
  filters?: { campaignId?: string; agendaId?: string },
): Promise<string[]> {
  const links = await fetchAiContentLinksByProductIds([productId], limit, filters);
  return links.map((link) => link.id);
}

export type AiContentProductLink = {
  id: string;
  productId: string;
  title: string | null;
};

export async function fetchAiContentLinksByProductIds(
  productIds: string[],
  limit: number,
  filters?: { campaignId?: string; agendaId?: string },
): Promise<AiContentProductLink[]> {
  if (productIds.length === 0) return [];
  let query = supabaseAdmin
    .from("ai_contents")
    .select("id, primary_product_id, title")
    .in("primary_product_id", productIds)
    .limit(limit);
  if (filters?.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters?.agendaId) query = query.eq("agenda_id", filters.agendaId);
  const { data, error } = await query;
  if (error) throw new Error(`ai_contents id lookup failed: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : null;
    const productId = typeof row.primary_product_id === "string" ? row.primary_product_id : null;
    if (!id || !productId) return [];
    return [
      {
        id,
        productId,
        title: typeof row.title === "string" && row.title.trim() !== "" ? row.title.trim() : null,
      },
    ];
  });
}

export async function fetchProductIdOccurrences(input: {
  table: "inquiries" | "travel_bookings" | "thread_marketing_posts" | "analytics_events";
  dateColumn: "created_at" | "published_at" | "occurred_at";
  productIds: string[];
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (input.productIds.length === 0) return counts;
  const { data, error } = await supabaseAdmin
    .from(input.table)
    .select("product_id")
    .in("product_id", input.productIds)
    .gte(input.dateColumn, input.periodStart)
    .lte(input.dateColumn, input.periodEnd)
    .limit(input.limit ?? 2000);
  if (error) throw new Error(`${input.table} lookup failed: ${error.message}`);
  const allowed = new Set(input.productIds);
  for (const row of data ?? []) {
    const productId = typeof row.product_id === "string" ? row.product_id : null;
    if (!productId || !allowed.has(productId)) continue;
    counts.set(productId, (counts.get(productId) ?? 0) + 1);
  }
  return counts;
}
