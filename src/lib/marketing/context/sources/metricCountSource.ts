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
  let query = supabaseAdmin
    .from("ai_contents")
    .select("id")
    .eq("primary_product_id", productId)
    .limit(limit);
  if (filters?.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters?.agendaId) query = query.eq("agenda_id", filters.agendaId);
  const { data, error } = await query;
  if (error) throw new Error(`ai_contents id lookup failed: ${error.message}`);
  return (data ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));
}
