import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteContentRow } from "@/lib/marketing/context/mappers/siteContentHistoryMapper";

type SitePeriodInput = {
  periodStart: string;
  periodEnd: string;
  limit: number;
  productId?: string;
};

export async function fetchNoticeRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("notices")
    .select("id, title, content, is_published, created_at, updated_at")
    .eq("is_published", true)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(`notices lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}

export async function fetchGuideRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("guides")
    .select("id, title, summary, is_published, created_at, updated_at")
    .eq("is_published", true)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(`guides lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}

export async function fetchFlyerDraftRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  let query = supabaseAdmin
    .from("flyer_drafts")
    .select("id, product_id, title, created_at, updated_at")
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.productId) query = query.eq("product_id", input.productId);
  const { data, error } = await query;
  if (error) throw new Error(`flyer_drafts lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}

export async function fetchHomeHeroContentRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("home_hero_content")
    .select("id, badge, main_copy_accent, main_copy_tail, sub_description, created_at, updated_at")
    .gte("updated_at", input.periodStart)
    .lte("updated_at", input.periodEnd)
    .order("updated_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(`home_hero_content lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}

export async function fetchHomeBannerRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("home_banners")
    .select("id, title, image_url, is_active, created_at")
    .eq("is_active", true)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(`home_banners lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}

export async function fetchMobileGolfAdLandingRows(input: SitePeriodInput): Promise<SiteContentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("mobile_golf_ad_landings")
    .select("id, title, slug, is_published, created_at, updated_at")
    .eq("is_published", true)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(`mobile_golf_ad_landings lookup failed: ${error.message}`);
  return (data as SiteContentRow[] | null) ?? [];
}
