/**
 * 관리자 analytics 읽기 전용 집계 레이어.
 * analytics_events 테이블에서만 읽기 수행. 기존 저장/트래킹 레이어는 변경하지 않음.
 * 후속 PR: AdminDashboardKpiSectionWithProvider, /api/admin/dashboard, AdminProductTaxonomyView 에서 사용.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseAdminDateRange } from "./dateRange";
import type {
  AdminAnalyticsOverview,
  AdminAnalyticsQueryParams,
  AnalyticsSummaryCounts,
  AnalyticsTaxonomyMetric,
  AnalyticsTopItem,
  AnalyticsSearchKeywordStat,
} from "./types";

const EVENT_HEADER_NAV_CLICK = "header_nav_click";
const EVENT_MEGA_MENU_CLICK = "mega_menu_click";
const EVENT_SEARCH_SUBMIT = "search_submit";
const EVENT_SEARCH_RESULT_CLICK = "search_result_click";
const EVENT_SEARCH_NO_RESULT = "search_no_result";
const EVENT_CTA_CLICK = "cta_click";
const EVENT_LANDING_VIEW = "landing_view";
const EVENT_LANDING_PRODUCT_CLICK = "landing_product_click";
const EVENT_PRODUCT_CARD_CLICK = "product_card_click";

const TOP_ITEMS_LIMIT = 10;
const FETCH_ROW_LIMIT = 5000;

/** 날짜 범위 필터용 start/end 반환. 집계 함수에서 공통 사용. */
export function buildAnalyticsDateRangeFilter(params: AdminAnalyticsQueryParams): {
  startIso: string;
  endIso: string;
} {
  const { startIso, endIso } = parseAdminDateRange({
    range: params.range,
    from: params.from,
    to: params.to,
  });
  return { startIso, endIso };
}

/** 조회 실패·null 시 0 반환. */
export function toSafeCount(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  return 0;
}

type RawRow = {
  event_name?: string | null;
  label?: string | null;
  href?: string | null;
  query?: string | null;
  taxonomy_type?: string | null;
  taxonomy_slug?: string | null;
};

/** 행 배열을 key(라벨/href)별로 집계해 상위 N개 TopItem 반환. */
export function toTopItems(
  rows: RawRow[],
  limit: number = TOP_ITEMS_LIMIT,
): AnalyticsTopItem[] {
  const map = new Map<string, { count: number; label: string; href?: string | null; taxonomyType?: "region" | "theme" | "category" | null; taxonomySlug?: string | null }>();
  for (const row of rows) {
    const key = (row.label ?? row.href ?? "unknown").toString().trim() || "unknown";
    const existing = map.get(key);
    const label = (row.label ?? key).toString().trim() || key;
    const taxonomyType =
      row.taxonomy_type === "category" || row.taxonomy_type === "theme" || row.taxonomy_type === "region"
        ? row.taxonomy_type
        : null;
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        count: 1,
        label,
        href: row.href ?? null,
        taxonomyType,
        taxonomySlug: row.taxonomy_slug ?? null,
      });
    }
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      taxonomyType: v.taxonomyType ?? null,
      taxonomySlug: v.taxonomySlug ?? null,
      href: v.href ?? null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** query/label 기준 집계 → AnalyticsSearchKeywordStat[]. */
export function toSearchKeywordStats(
  rows: { query?: string | null; label?: string | null }[],
  limit: number = TOP_ITEMS_LIMIT,
): AnalyticsSearchKeywordStat[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const keyword = (row.query ?? row.label ?? "").toString().trim() || "(empty)";
    map.set(keyword, (map.get(keyword) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 단일 event_name 조건으로 count 조회. 실패 시 0. */
async function countByEvent(
  eventName: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", eventName)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso);
    if (error) return 0;
    return toSafeCount(count);
  } catch {
    return 0;
  }
}

/** event_name + 날짜 조건으로 행 조회. 실패 시 []. */
async function fetchRowsByEvent(
  eventName: string,
  startIso: string,
  endIso: string,
  columns: string = "label,href,query,taxonomy_type,taxonomy_slug",
): Promise<RawRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select(columns)
      .eq("event_name", eventName)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .limit(FETCH_ROW_LIMIT);
    if (error) return [];
    return (data ?? []) as RawRow[];
  } catch {
    return [];
  }
}

const EMPTY_SUMMARY: AnalyticsSummaryCounts = {
  headerNavClicks: 0,
  megaMenuClicks: 0,
  searchSubmits: 0,
  searchResultClicks: 0,
  searchNoResultCount: 0,
  ctaClicks: 0,
  landingViews: 0,
  landingProductClicks: 0,
  productCardClicks: 0,
};

const EMPTY_OVERVIEW: AdminAnalyticsOverview = {
  summary: EMPTY_SUMMARY,
  topHeaderItems: [],
  topMegaMenuItems: [],
  topCtas: [],
  topSearchKeywords: [],
  topNoResultKeywords: [],
};

/**
 * 관리자 대시보드용 analytics 개요.
 * KPI 요약 + Top 헤더/메가메뉴/CTA/검색어/무결과 키워드.
 */
export async function getAdminAnalyticsOverview(
  params: AdminAnalyticsQueryParams,
): Promise<AdminAnalyticsOverview> {
  try {
    const { startIso, endIso } = buildAnalyticsDateRangeFilter(params);

    const [
      headerNavClicks,
      megaMenuClicks,
      searchSubmits,
      searchResultClicks,
      searchNoResultCount,
      ctaClicks,
      landingViews,
      landingProductClicks,
      productCardClicks,
      headerRows,
      megaMenuRows,
      ctaRows,
      searchSubmitRows,
      searchNoResultRows,
    ] = await Promise.all([
      countByEvent(EVENT_HEADER_NAV_CLICK, startIso, endIso),
      countByEvent(EVENT_MEGA_MENU_CLICK, startIso, endIso),
      countByEvent(EVENT_SEARCH_SUBMIT, startIso, endIso),
      countByEvent(EVENT_SEARCH_RESULT_CLICK, startIso, endIso),
      countByEvent(EVENT_SEARCH_NO_RESULT, startIso, endIso),
      countByEvent(EVENT_CTA_CLICK, startIso, endIso),
      countByEvent(EVENT_LANDING_VIEW, startIso, endIso),
      countByEvent(EVENT_LANDING_PRODUCT_CLICK, startIso, endIso),
      countByEvent(EVENT_PRODUCT_CARD_CLICK, startIso, endIso),
      fetchRowsByEvent(EVENT_HEADER_NAV_CLICK, startIso, endIso),
      fetchRowsByEvent(EVENT_MEGA_MENU_CLICK, startIso, endIso),
      fetchRowsByEvent(EVENT_CTA_CLICK, startIso, endIso),
      fetchRowsByEvent(EVENT_SEARCH_SUBMIT, startIso, endIso, "query,label"),
      fetchRowsByEvent(EVENT_SEARCH_NO_RESULT, startIso, endIso, "query,label"),
    ]);

    return {
      summary: {
        headerNavClicks,
        megaMenuClicks,
        searchSubmits,
        searchResultClicks,
        searchNoResultCount,
        ctaClicks,
        landingViews,
        landingProductClicks,
        productCardClicks,
      },
      topHeaderItems: toTopItems(headerRows, TOP_ITEMS_LIMIT),
      topMegaMenuItems: toTopItems(megaMenuRows, TOP_ITEMS_LIMIT),
      topCtas: toTopItems(ctaRows, TOP_ITEMS_LIMIT),
      topSearchKeywords: toSearchKeywordStats(searchSubmitRows, TOP_ITEMS_LIMIT),
      topNoResultKeywords: toSearchKeywordStats(searchNoResultRows, TOP_ITEMS_LIMIT),
    };
  } catch {
    return EMPTY_OVERVIEW;
  }
}

/**
 * 이벤트별 Top N 아이템. 대시보드 차트/Top 리스트용.
 */
export async function getTopAnalyticsItemsByEvent(params: {
  eventName: string;
  startIso: string;
  endIso: string;
  limit?: number;
}): Promise<AnalyticsTopItem[]> {
  try {
    const rows = await fetchRowsByEvent(
      params.eventName,
      params.startIso,
      params.endIso,
    );
    return toTopItems(rows, params.limit ?? TOP_ITEMS_LIMIT);
  } catch {
    return [];
  }
}

/**
 * 검색 키워드 통계. search_submit / search_no_result 등 이벤트별.
 */
export async function getSearchKeywordStats(params: {
  eventName: string;
  startIso: string;
  endIso: string;
  limit?: number;
}): Promise<AnalyticsSearchKeywordStat[]> {
  try {
    const rows = await fetchRowsByEvent(
      params.eventName,
      params.startIso,
      params.endIso,
      "query,label",
    );
    return toSearchKeywordStats(rows, params.limit ?? TOP_ITEMS_LIMIT);
  } catch {
    return [];
  }
}

/**
 * taxonomy(카테고리/테마)별 성과.
 * taxonomy 관리 탭 성과 컬럼용. 현재는 taxonomy_type/taxonomy_slug 가 있는 이벤트만 집계.
 * searchInboundCount: 저장 payload에 taxonomy 연결이 명확한 경우에만 증가. 현재는 search_result_click 등에서
 * taxonomy_slug 매핑이 없을 수 있어 0 반환 가능. (TODO: 검색 결과 → taxonomy 매핑 필드 추가 시 정확도 상승)
 */
export async function getTaxonomyAnalyticsMetrics(params: AdminAnalyticsQueryParams & {
  taxonomyType?: "category" | "theme";
}): Promise<AnalyticsTaxonomyMetric[]> {
  try {
    const { startIso, endIso } = buildAnalyticsDateRangeFilter(params);
    const filterType = params.taxonomyType ?? null;

    const { data: headerRows, error: headerErr } = await supabaseAdmin
      .from("analytics_events")
      .select("taxonomy_type,taxonomy_slug,taxonomy_id,taxonomy_name")
      .in("event_name", [EVENT_HEADER_NAV_CLICK, EVENT_MEGA_MENU_CLICK, "mobile_menu_click"])
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .not("taxonomy_type", "is", null)
      .not("taxonomy_slug", "is", null)
      .limit(FETCH_ROW_LIMIT);

    if (headerErr) return [];

    type Row = { taxonomy_type?: string | null; taxonomy_slug?: string | null; taxonomy_id?: string | null; taxonomy_name?: string | null };
    const rows = (headerRows ?? []) as Row[];
    const filtered = filterType
      ? rows.filter((r) => r.taxonomy_type === filterType)
      : rows;

    const bySlug = new Map<
      string,
      { taxonomyId: string | null; taxonomyName: string; taxonomySlug: string; headerClickCount: number }
    >();
    for (const r of filtered) {
      const slug = (r.taxonomy_slug ?? "").trim();
      const name = (r.taxonomy_name ?? slug).trim() || slug;
      if (!slug) continue;
      const key = `${r.taxonomy_type ?? ""}:${slug}`;
      const cur = bySlug.get(key);
      if (cur) {
        cur.headerClickCount += 1;
      } else {
        bySlug.set(key, {
          taxonomyId: r.taxonomy_id ?? null,
          taxonomyName: name,
          taxonomySlug: slug,
          headerClickCount: 1,
        });
      }
    }

    // searchInboundCount: 현재 저장 구조상 search_result_click에 taxonomy 매핑이 없을 수 있음 → 0.
    // TODO: 검색 결과 페이지에서 taxonomy_slug 등 필드 전송 시 여기서 집계 추가.
    const searchInboundCount = 0;

    const { data: landingViewRows, error: lvErr } = await supabaseAdmin
      .from("analytics_events")
      .select("taxonomy_type,taxonomy_slug,taxonomy_id,taxonomy_name")
      .eq("event_name", EVENT_LANDING_VIEW)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .not("taxonomy_type", "is", null)
      .not("taxonomy_slug", "is", null)
      .limit(FETCH_ROW_LIMIT);

    const { data: landingClickRows, error: lcErr } = await supabaseAdmin
      .from("analytics_events")
      .select("taxonomy_type,taxonomy_slug,taxonomy_id,taxonomy_name")
      .eq("event_name", EVENT_LANDING_PRODUCT_CLICK)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .not("taxonomy_type", "is", null)
      .not("taxonomy_slug", "is", null)
      .limit(FETCH_ROW_LIMIT);

    const viewByKey = new Map<string, number>();
    if (!lvErr && landingViewRows) {
      for (const r of landingViewRows as Row[]) {
        const slug = (r.taxonomy_slug ?? "").trim();
        if (!slug) continue;
        const key = `${r.taxonomy_type ?? ""}:${slug}`;
        if (filterType && r.taxonomy_type !== filterType) continue;
        viewByKey.set(key, (viewByKey.get(key) ?? 0) + 1);
      }
    }
    const clickByKey = new Map<string, number>();
    if (!lcErr && landingClickRows) {
      for (const r of landingClickRows as Row[]) {
        const slug = (r.taxonomy_slug ?? "").trim();
        if (!slug) continue;
        const key = `${r.taxonomy_type ?? ""}:${slug}`;
        if (filterType && r.taxonomy_type !== filterType) continue;
        clickByKey.set(key, (clickByKey.get(key) ?? 0) + 1);
      }
    }

    const allKeys = new Set([...bySlug.keys(), ...viewByKey.keys(), ...clickByKey.keys()]);
    const result: AnalyticsTaxonomyMetric[] = [];
    for (const key of allKeys) {
      const [type, slug] = key.split(":");
      if (type !== "category" && type !== "theme") continue;
      const base = bySlug.get(key);
      const headerClickCount = base?.headerClickCount ?? 0;
      const landingViewCount = viewByKey.get(key) ?? 0;
      const landingProductClickCount = clickByKey.get(key) ?? 0;
      const landingCtr =
        landingViewCount > 0 ? landingProductClickCount / landingViewCount : null;
      result.push({
        taxonomyType: type as "category" | "theme",
        taxonomyId: base?.taxonomyId ?? null,
        taxonomyName: base?.taxonomyName ?? slug,
        taxonomySlug: slug,
        headerClickCount,
        searchInboundCount,
        landingViewCount,
        landingProductClickCount,
        landingCtr,
      });
    }
    return result.sort((a, b) => b.headerClickCount - a.headerClickCount);
  } catch {
    return [];
  }
}
