import { landingSlugFromSourcePath } from "@/lib/analytics/createAnalyticsPayload";
import {
  LANDING_ANALYTICS_MIN_CLICKS_FOR_CTR_TOP,
  LANDING_ANALYTICS_MIN_CLICKS_FOR_CVR_TOP,
  LANDING_ANALYTICS_MIN_VIEWS_FOR_CTR_TOP,
  LANDING_ANALYTICS_TOP_PERFORMERS_LIMIT,
  LANDING_ANALYTICS_UNATTRIBUTED_SLUG,
  LANDING_ANALYTICS_UNATTRIBUTED_TITLE,
} from "@/lib/adminLandings/analyticsConstants";
import { createAdminLandingsRepository } from "@/lib/adminLandings/repository";
import { mapRecordToAdminLandingListItem } from "@/lib/adminLandings/mappers";
import type { AdminLandingRecord } from "@/lib/adminLandings/types";
import type {
  LandingAnalyticsItem,
  LandingAnalyticsRange,
  LandingAnalyticsResponse,
  LandingAnalyticsSort,
  LandingAnalyticsSummary,
  LandingAnalyticsTopPerformers,
  LandingAnalyticsTrendPoint,
} from "@/lib/adminLandings/landingAnalyticsModels";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type {
  LandingAnalyticsItem,
  LandingAnalyticsRange,
  LandingAnalyticsResponse,
  LandingAnalyticsSort,
  LandingAnalyticsSummary,
  LandingAnalyticsTopPerformers,
  LandingAnalyticsTrendPoint,
} from "@/lib/adminLandings/landingAnalyticsModels";

export {
  parseLandingAnalyticsRangeParam,
  parseLandingAnalyticsSortParam,
} from "@/lib/adminLandings/landingAnalyticsModels";

const FUNNEL_EVENTS = ["landing_view", "landing_cta_click", "quote_submit"] as const;

const PAGE_SIZE = 1000;
const MAX_ROWS = 25000;

type FunnelRow = {
  event_name: string;
  landing_slug: string | null;
  source_path: string | null;
  occurred_at: string | null;
};

function resolveSlugFromRecord(record: AdminLandingRecord): string {
  const item = mapRecordToAdminLandingListItem(record);
  return item.slug;
}

function rowLandingSlug(row: {
  landing_slug?: string | null;
  source_path?: string | null;
}): string | null {
  const direct = typeof row.landing_slug === "string" ? row.landing_slug.trim() : "";
  if (direct) return direct;
  return landingSlugFromSourcePath(row.source_path ?? undefined);
}

function startIsoForRange(range: LandingAnalyticsRange): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** 공통: 분모 0 및 비유한값 방지 */
export function landingAnalyticsRatio(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return num / den;
}

function utcDateFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseUtcDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

/** 양 끝 포함, UTC 달력일 기준 연속 시계열 */
function enumerateDaysInclusive(fromYmd: string, toYmd: string): string[] {
  let a = parseUtcDay(fromYmd);
  let b = parseUtcDay(toYmd);
  if (a.getTime() > b.getTime()) {
    const t = a;
    a = b;
    b = t;
  }
  const out: string[] = [];
  const cur = new Date(a.getTime());
  while (cur.getTime() <= b.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

async function fetchFunnelEventRows(startIso: string | null): Promise<FunnelRow[]> {
  const out: FunnelRow[] = [];
  let from = 0;

  while (from < MAX_ROWS) {
    let q = supabaseAdmin
      .from("analytics_events")
      .select("event_name, landing_slug, source_path, occurred_at")
      .in("event_name", [...FUNNEL_EVENTS])
      .order("occurred_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (startIso) {
      q = q.gte("occurred_at", startIso);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[landingAnalytics] fetch rows:", error.message);
      break;
    }
    const batch = data ?? [];
    for (const r of batch) {
      out.push({
        event_name: String((r as { event_name?: string }).event_name ?? ""),
        landing_slug: (r as { landing_slug?: string | null }).landing_slug ?? null,
        source_path: (r as { source_path?: string | null }).source_path ?? null,
        occurred_at:
          typeof (r as { occurred_at?: string | null }).occurred_at === "string"
            ? ((r as { occurred_at?: string }).occurred_at as string)
            : null,
      });
    }
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return out;
}

type LandingMeta = {
  id: string;
  title: string;
  templateType: string;
  taxonomyType: string | null;
};

function buildLandingMetaMap(records: AdminLandingRecord[]): Map<string, LandingMeta> {
  const map = new Map<string, LandingMeta>();
  for (const rec of records) {
    const slug = resolveSlugFromRecord(rec);
    if (!slug) continue;
    const item = mapRecordToAdminLandingListItem(rec);
    const tt = rec.source_taxonomy_type?.trim();
    map.set(slug, {
      id: rec.id,
      title: item.title,
      templateType: item.templateType,
      taxonomyType: tt || null,
    });
  }
  return map;
}

function buildDailyGlobalCounts(rows: FunnelRow[]): Map<string, { views: number; clicks: number; submits: number }> {
  const daily = new Map<string, { views: number; clicks: number; submits: number }>();
  for (const row of rows) {
    if (!row.occurred_at) continue;
    const day = utcDateFromIso(row.occurred_at);
    if (!day) continue;
    if (!daily.has(day)) {
      daily.set(day, { views: 0, clicks: 0, submits: 0 });
    }
    const b = daily.get(day)!;
    if (row.event_name === "landing_view") b.views += 1;
    else if (row.event_name === "landing_cta_click") b.clicks += 1;
    else if (row.event_name === "quote_submit") b.submits += 1;
  }
  return daily;
}

function buildTrendSeries(
  rows: FunnelRow[],
  range: LandingAnalyticsRange,
  startIso: string | null,
): LandingAnalyticsTrendPoint[] {
  const daily = buildDailyGlobalCounts(rows);

  let orderedDays: string[];
  if (range === "all") {
    const keys = [...daily.keys()].sort();
    if (keys.length === 0) {
      orderedDays = [];
    } else {
      orderedDays = enumerateDaysInclusive(keys[0]!, keys[keys.length - 1]!);
    }
  } else {
    const startDay = startIso ? utcDateFromIso(startIso) : null;
    const endDay = utcDateFromIso(new Date().toISOString());
    if (!startDay || !endDay) {
      orderedDays = [];
    } else {
      orderedDays = enumerateDaysInclusive(startDay, endDay);
    }
  }

  return orderedDays.map((date) => {
    const c = daily.get(date) ?? { views: 0, clicks: 0, submits: 0 };
    return {
      date,
      views: c.views,
      clicks: c.clicks,
      submits: c.submits,
      ctr: landingAnalyticsRatio(c.clicks, c.views),
      cvr: landingAnalyticsRatio(c.submits, c.clicks),
    };
  });
}

function computeTopPerformers(items: LandingAnalyticsItem[]): LandingAnalyticsTopPerformers {
  const limit = LANDING_ANALYTICS_TOP_PERFORMERS_LIMIT;
  const ranked = items.filter((i) => i.landingSlug !== LANDING_ANALYTICS_UNATTRIBUTED_SLUG);

  const bySubmits = [...ranked].sort((a, b) => {
    if (b.submits !== a.submits) return b.submits - a.submits;
    if (b.clicks !== a.clicks) return b.clicks - a.clicks;
    return b.views - a.views;
  }).slice(0, limit);

  const byCTR = [...ranked]
    .filter(
      (i) =>
        i.views >= LANDING_ANALYTICS_MIN_VIEWS_FOR_CTR_TOP ||
        i.clicks >= LANDING_ANALYTICS_MIN_CLICKS_FOR_CTR_TOP,
    )
    .sort((a, b) => {
      if (b.ctr !== a.ctr) return b.ctr - a.ctr;
      if (b.submits !== a.submits) return b.submits - a.submits;
      return b.views - a.views;
    })
    .slice(0, limit);

  const byCVR = [...ranked]
    .filter((i) => i.clicks >= LANDING_ANALYTICS_MIN_CLICKS_FOR_CVR_TOP)
    .sort((a, b) => {
      if (b.cvr !== a.cvr) return b.cvr - a.cvr;
      if (b.submits !== a.submits) return b.submits - a.submits;
      return b.clicks - a.clicks;
    })
    .slice(0, limit);

  return { bySubmits, byCTR, byCVR };
}

export async function fetchLandingAnalytics(input: {
  range: LandingAnalyticsRange;
  sort?: LandingAnalyticsSort;
}): Promise<LandingAnalyticsResponse> {
  const sort = input.sort ?? "submits";
  const startIso = startIsoForRange(input.range);

  const [rows, landingRecords] = await Promise.all([
    fetchFunnelEventRows(startIso),
    createAdminLandingsRepository().list(),
  ]);

  const landingMeta = buildLandingMetaMap(landingRecords);

  const counts = new Map<string, { views: number; clicks: number; submits: number }>();

  for (const row of rows) {
    const slug = rowLandingSlug(row) ?? LANDING_ANALYTICS_UNATTRIBUTED_SLUG;
    if (!counts.has(slug)) {
      counts.set(slug, { views: 0, clicks: 0, submits: 0 });
    }
    const bucket = counts.get(slug)!;
    if (row.event_name === "landing_view") bucket.views += 1;
    else if (row.event_name === "landing_cta_click") bucket.clicks += 1;
    else if (row.event_name === "quote_submit") bucket.submits += 1;
  }

  const slugSet = new Set<string>([...counts.keys(), ...landingMeta.keys()]);
  const items: LandingAnalyticsItem[] = [];

  for (const landingSlug of slugSet) {
    const c = counts.get(landingSlug) ?? { views: 0, clicks: 0, submits: 0 };
    const meta = landingMeta.get(landingSlug);
    const ctr = landingAnalyticsRatio(c.clicks, c.views);
    const cvr = landingAnalyticsRatio(c.submits, c.clicks);
    items.push({
      landingSlug,
      landingId: meta?.id ?? null,
      title:
        landingSlug === LANDING_ANALYTICS_UNATTRIBUTED_SLUG
          ? LANDING_ANALYTICS_UNATTRIBUTED_TITLE
          : (meta?.title ?? landingSlug),
      templateType: meta?.templateType ?? "—",
      taxonomyType: meta?.taxonomyType ?? null,
      views: c.views,
      clicks: c.clicks,
      submits: c.submits,
      ctr,
      cvr,
    });
  }

  items.sort((a, b) => {
    if (sort === "ctr") {
      if (b.ctr !== a.ctr) return b.ctr - a.ctr;
      return b.submits - a.submits;
    }
    if (b.submits !== a.submits) return b.submits - a.submits;
    return b.views - a.views;
  });

  const totalViews = items.reduce((s, i) => s + i.views, 0);
  const totalClicks = items.reduce((s, i) => s + i.clicks, 0);
  const totalSubmits = items.reduce((s, i) => s + i.submits, 0);

  const summary: LandingAnalyticsSummary = {
    totalViews,
    totalClicks,
    totalSubmits,
    avgCTR: landingAnalyticsRatio(totalClicks, totalViews),
    avgCVR: landingAnalyticsRatio(totalSubmits, totalClicks),
  };

  const trend = buildTrendSeries(rows, input.range, startIso);
  const topPerformers = computeTopPerformers(items);

  return { summary, items, trend, topPerformers };
}
