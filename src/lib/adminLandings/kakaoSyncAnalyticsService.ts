import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KAKAO_SIGNUP_WELCOME_REF_TYPE } from "@/lib/auth/kakaoSignupWelcome";
import {
  isKakaoSyncAnalyticsEvent,
  resolveKakaoSyncCampaign,
} from "@/lib/adminLandings/kakaoSyncAnalyticsFilters";
import { KAKAO_SYNC_GOLF_LANDING_SLUG } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";
import type {
  KakaoSyncAnalyticsCampaignRow,
  KakaoSyncAnalyticsRange,
  KakaoSyncAnalyticsResponse,
  KakaoSyncAnalyticsSummary,
  KakaoSyncAnalyticsTrendPoint,
} from "@/lib/adminLandings/kakaoSyncAnalyticsModels";
import { fetchKakaoMomentAnalyticsBlock } from "@/lib/adminLandings/kakaoMomentImportService";

function rangeStartIso(range: KakaoSyncAnalyticsRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString();
}

function toYmd(iso: string): string {
  return iso.slice(0, 10);
}

function emptyTrend(range: KakaoSyncAnalyticsRange): KakaoSyncAnalyticsTrendPoint[] {
  if (range === "all") return [];
  const days = range === "7d" ? 7 : 30;
  const out: KakaoSyncAnalyticsTrendPoint[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    out.push({
      date: cursor.toISOString().slice(0, 10),
      views: 0,
      clicks: 0,
      oauthStarts: 0,
      signups: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function campaignKey(row: {
  template_type?: string | null;
  landing_slug?: string | null;
  source_path?: string | null;
}): { key: string; label: string; templateType: string } {
  return resolveKakaoSyncCampaign(row);
}

function metadataIngest(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const ingest = (metadata as Record<string, unknown>).ingest;
  return typeof ingest === "string" ? ingest : null;
}

/**
 * 클라이언트·서버 이중 기록 시 집계 규칙:
 * - landing_view: ingest=client 제외 (middleware/레거시만)
 * - landing_cta_click: ingest=client 제외 (oauth_start 보정/레거시만)
 */
function shouldCountEvent(row: {
  event_name?: string | null;
  metadata?: unknown;
}): boolean {
  const name = String(row.event_name ?? "");
  const ingest = metadataIngest(row.metadata);
  if (name === "landing_view" && ingest === "client") return false;
  if (name === "landing_cta_click" && ingest === "client") return false;
  return true;
}

/** PostgREST or: 카카오싱크 후보만 조회해 전역 2만 건 truncation 회피 */
const KAKAO_SYNC_EVENT_OR = [
  `template_type.in.(kakao_sync_golf,mobile_golf_ad)`,
  `landing_slug.eq.${KAKAO_SYNC_GOLF_LANDING_SLUG}`,
  `source_path.ilike./golf/kakao-sync%`,
  `source_path.ilike./golf/ads/%`,
  `page_path.ilike./golf/kakao-sync%`,
  `page_path.ilike./golf/ads/%`,
  `section.eq.kakao_sync_golf_landing`,
  `section.eq.kakao_sync_cta`,
].join(",");

export async function fetchKakaoSyncAnalytics(input: {
  range: KakaoSyncAnalyticsRange;
  momentImportId?: string | null;
}): Promise<KakaoSyncAnalyticsResponse> {
  const since = rangeStartIso(input.range);

  let eventsQuery = supabaseAdmin
    .from("analytics_events")
    .select(
      "event_name, template_type, landing_slug, source_path, page_path, section, metadata, occurred_at",
    )
    .in("event_name", [
      "landing_view",
      "landing_cta_click",
      "kakao_oauth_start",
      "kakao_signup_new",
      "product_card_click",
    ])
    .or(KAKAO_SYNC_EVENT_OR)
    .order("occurred_at", { ascending: false })
    .limit(20000);

  if (since) eventsQuery = eventsQuery.gte("occurred_at", since);

  const welcomeQuery = (() => {
    let q = supabaseAdmin
      .from("point_ledger")
      .select("id, created_at", { count: "exact" })
      .eq("ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE);
    if (since) q = q.gte("created_at", since);
    return q;
  })();

  const channelQuery = (() => {
    let q = supabaseAdmin
      .from("members")
      .select("id, kakao_channel_added, created_at", { count: "exact" })
      .not("kakao_channel_added", "is", null);
    if (since) q = q.gte("created_at", since);
    return q;
  })();

  const leadsQuery = (() => {
    let q = supabaseAdmin
      .from("golf_tour_leads")
      .select("id", { count: "exact" })
      .eq("utm_source", "kakao")
      .eq("utm_medium", "bizboard");
    if (since) q = q.gte("created_at", since);
    return q;
  })();

  const [eventsRes, welcomeRes, channelRes, leadsRes, moment] = await Promise.all([
    eventsQuery,
    welcomeQuery,
    channelQuery,
    leadsQuery,
    fetchKakaoMomentAnalyticsBlock(input.momentImportId).catch((err) => {
      console.error("[kakaoSyncAnalytics] moment block:", err);
      return null;
    }),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (welcomeRes.error) throw new Error(welcomeRes.error.message);
  if (channelRes.error) throw new Error(channelRes.error.message);
  if (leadsRes.error) throw new Error(leadsRes.error.message);

  const events = (eventsRes.data ?? [])
    .filter((row) => isKakaoSyncAnalyticsEvent(row))
    .filter((row) => shouldCountEvent(row));

  let landingViews = 0;
  let ctaClicks = 0;
  let oauthStarts = 0;
  let newSignups = 0;
  let productClicks = 0;

  const trendMap = new Map<string, KakaoSyncAnalyticsTrendPoint>();
  for (const p of emptyTrend(input.range)) trendMap.set(p.date, { ...p });

  const campaignMap = new Map<string, KakaoSyncAnalyticsCampaignRow>();

  for (const row of events) {
    const name = String(row.event_name ?? "");
    const ymd = toYmd(String(row.occurred_at ?? ""));
    const bucket =
      trendMap.get(ymd) ??
      ({ date: ymd, views: 0, clicks: 0, oauthStarts: 0, signups: 0 } satisfies KakaoSyncAnalyticsTrendPoint);

    const campMeta = campaignKey(row);
    const camp =
      campaignMap.get(campMeta.key) ??
      ({
        key: campMeta.key,
        label: campMeta.label,
        templateType: campMeta.templateType,
        views: 0,
        clicks: 0,
        ctr: 0,
        signups: 0,
      } satisfies KakaoSyncAnalyticsCampaignRow);

    if (name === "landing_view") {
      landingViews += 1;
      bucket.views += 1;
      camp.views += 1;
    } else if (name === "landing_cta_click") {
      ctaClicks += 1;
      bucket.clicks += 1;
      camp.clicks += 1;
    } else if (name === "kakao_oauth_start") {
      oauthStarts += 1;
      bucket.oauthStarts += 1;
    } else if (name === "kakao_signup_new") {
      newSignups += 1;
      bucket.signups += 1;
      camp.signups += 1;
    } else if (name === "product_card_click") {
      productClicks += 1;
    }

    trendMap.set(ymd, bucket);
    campaignMap.set(campMeta.key, camp);
  }

  const channelRows = channelRes.data ?? [];
  const channelKnown = channelRows.length;
  const channelAdded = channelRows.filter((r) => r.kakao_channel_added === true).length;

  const welcomeGrants = welcomeRes.count ?? welcomeRes.data?.length ?? 0;
  const bizboardLeads = leadsRes.count ?? 0;

  const summary: KakaoSyncAnalyticsSummary = {
    landingViews,
    ctaClicks,
    ctr: landingViews > 0 ? ctaClicks / landingViews : 0,
    oauthStarts,
    newSignups,
    welcomeGrants,
    channelAdded,
    channelKnown,
    channelAddRate: channelKnown > 0 ? channelAdded / channelKnown : 0,
    productClicks,
    bizboardLeads,
    oauthToSignupRate: oauthStarts > 0 ? newSignups / oauthStarts : 0,
    viewToSignupRate: landingViews > 0 ? newSignups / landingViews : 0,
  };

  const campaigns = [...campaignMap.values()]
    .map((c) => ({
      ...c,
      ctr: c.views > 0 ? c.clicks / c.views : 0,
    }))
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks);

  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return { summary, trend, campaigns, moment };
}
