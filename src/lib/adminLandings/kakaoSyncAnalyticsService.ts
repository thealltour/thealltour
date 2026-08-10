import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KAKAO_SIGNUP_WELCOME_REF_TYPE } from "@/lib/auth/kakaoSignupWelcome";
import {
  isKakaoSyncAnalyticsEvent,
  resolveKakaoSyncCampaign,
  shouldCountKakaoSyncAnalyticsEvent,
} from "@/lib/adminLandings/kakaoSyncAnalyticsFilters";
import { aggregateKakaoOAuthFailures } from "@/lib/adminLandings/kakaoOAuthFailureStats";
import { KAKAO_SYNC_GOLF_LANDING_SLUG } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";
import type {
  KakaoSyncAnalyticsCampaignRow,
  KakaoSyncAnalyticsRange,
  KakaoSyncAnalyticsResponse,
  KakaoSyncAnalyticsSummary,
  KakaoSyncAnalyticsTrendPoint,
} from "@/lib/adminLandings/kakaoSyncAnalyticsModels";
import { fetchKakaoMomentAnalyticsBlock } from "@/lib/adminLandings/kakaoMomentImportService";
import {
  resolveKakaoSyncAnalyticsWindow,
  toKstYmd,
} from "@/lib/adminLandings/kakaoSyncAnalyticsRange";

function emptyTrendPoint(date: string): KakaoSyncAnalyticsTrendPoint {
  return {
    date,
    views: 0,
    clicks: 0,
    oauthStarts: 0,
    signups: 0,
    returning: 0,
    oauthFailed: 0,
  };
}

function campaignKey(row: {
  template_type?: string | null;
  landing_slug?: string | null;
  source_path?: string | null;
}): { key: string; label: string; templateType: string } {
  return resolveKakaoSyncCampaign(row);
}

/** PostgREST or: 카카오싱크 후보만 조회해 전역 2만 건 truncation 회피 */
const KAKAO_SYNC_EVENT_OR = [
  `template_type.in.(kakao_sync_golf,mobile_golf_ad)`,
  `landing_slug.eq.${KAKAO_SYNC_GOLF_LANDING_SLUG}`,
  `source_path.ilike./golf/kakao-sync%`,
  `source_path.ilike./golf/ads/%`,
  `page_path.ilike./golf/kakao-sync%`,
  `page_path.ilike./golf/ads/%`,
  /** landing_slug 없어도 metadata.funnel=kakao_sync 인 콜백 실패를 조회 */
  `page_path.eq./api/auth/kakao/callback`,
  `section.eq.kakao_sync_golf_landing`,
  `section.eq.kakao_sync_cta`,
].join(",");

export async function fetchKakaoSyncAnalytics(input: {
  range: KakaoSyncAnalyticsRange;
  date?: string | null;
  momentImportId?: string | null;
}): Promise<KakaoSyncAnalyticsResponse> {
  const window = resolveKakaoSyncAnalyticsWindow(input.range, input.date);
  const since = window.since;
  const until = window.until;

  let eventsQuery = supabaseAdmin
    .from("analytics_events")
    .select(
      "event_name, template_type, landing_slug, source_path, page_path, section, metadata, occurred_at",
    )
    .in("event_name", [
      "landing_view",
      "landing_cta_click",
      "kakao_oauth_start",
      "kakao_oauth_success",
      "kakao_signup_new",
      "kakao_login_returning",
      "kakao_oauth_failed",
      "product_card_click",
    ])
    .or(KAKAO_SYNC_EVENT_OR)
    .order("occurred_at", { ascending: false })
    .limit(20000);

  if (since) eventsQuery = eventsQuery.gte("occurred_at", since);
  if (until) eventsQuery = eventsQuery.lte("occurred_at", until);

  const welcomeQuery = (() => {
    let q = supabaseAdmin
      .from("point_ledger")
      .select("id, created_at", { count: "exact" })
      .eq("ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    return q;
  })();

  const channelQuery = (() => {
    let q = supabaseAdmin
      .from("members")
      .select("id, kakao_channel_added, created_at", { count: "exact" })
      .not("kakao_channel_added", "is", null);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    return q;
  })();

  const leadsQuery = (() => {
    let q = supabaseAdmin
      .from("golf_tour_leads")
      .select("id", { count: "exact" })
      .eq("utm_source", "kakao")
      .eq("utm_medium", "bizboard");
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);
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
    .filter((row) => shouldCountKakaoSyncAnalyticsEvent(row));

  let landingViews = 0;
  let ctaClicks = 0;
  let oauthStarts = 0;
  let oauthSuccess = 0;
  let oauthFailed = 0;
  let loginReturning = 0;
  let oauthNeedsLink = 0;
  let newSignups = 0;
  let productClicks = 0;

  const trendMap = new Map<string, KakaoSyncAnalyticsTrendPoint>();
  for (const d of window.trendDates) trendMap.set(d, emptyTrendPoint(d));

  const campaignMap = new Map<string, KakaoSyncAnalyticsCampaignRow>();

  for (const row of events) {
    const name = String(row.event_name ?? "");
    const ymd = toKstYmd(String(row.occurred_at ?? ""));
    const bucket =
      trendMap.get(ymd) ??
      ({
        date: ymd,
        views: 0,
        clicks: 0,
        oauthStarts: 0,
        signups: 0,
        returning: 0,
        oauthFailed: 0,
      } satisfies KakaoSyncAnalyticsTrendPoint);

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
    } else if (name === "kakao_oauth_success") {
      oauthSuccess += 1;
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      if (meta?.needsLink === true) oauthNeedsLink += 1;
    } else if (name === "kakao_oauth_failed") {
      oauthFailed += 1;
      bucket.oauthFailed += 1;
    } else if (name === "kakao_login_returning") {
      loginReturning += 1;
      bucket.returning += 1;
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
    oauthSuccess,
    oauthFailed,
    loginReturning,
    oauthNeedsLink,
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

  const { breakdown: oauthFailureBreakdown, recent: oauthFailureRecent } =
    aggregateKakaoOAuthFailures(events);

  return { summary, trend, campaigns, oauthFailureBreakdown, oauthFailureRecent, moment };
}
