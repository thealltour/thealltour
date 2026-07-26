import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseKakaoMomentCreativeCsv } from "@/lib/adminLandings/kakaoMomentCsv";
import type {
  KakaoMomentAnalyticsBlock,
  KakaoMomentCampaignRankRow,
  KakaoMomentCreativeRankRow,
  KakaoMomentCreativeRow,
  KakaoMomentImportListItem,
  KakaoMomentParseResult,
} from "@/lib/adminLandings/kakaoMomentModels";

const TOP_N = 20;

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function periodEndExclusiveIso(periodEndYmd: string): string {
  const d = new Date(`${periodEndYmd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function periodStartIso(periodStartYmd: string): string {
  return `${periodStartYmd}T00:00:00.000Z`;
}

export function previewKakaoMomentCsv(csvText: string): KakaoMomentParseResult {
  return parseKakaoMomentCreativeCsv(csvText);
}

type CreativeDbRow = {
  creative_name: string;
  creative_id: string | null;
  status: string | null;
  ad_group_name: string | null;
  ad_group_id: string | null;
  campaign_name: string | null;
  campaign_id: string | null;
  cost: number | string;
  impressions: number | string;
  clicks: number | string;
  ctr: number | string;
  reach: number | string;
  cpc: number | string;
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function aggregateCreatives(rows: CreativeDbRow[]): {
  cost: number;
  impressions: number;
  clicks: number;
  reach: number;
  campaigns: KakaoMomentCampaignRankRow[];
  creatives: KakaoMomentCreativeRankRow[];
} {
  let cost = 0;
  let impressions = 0;
  let clicks = 0;
  let reach = 0;
  const campMap = new Map<string, KakaoMomentCampaignRankRow>();

  const creatives: KakaoMomentCreativeRankRow[] = rows.map((r, i) => {
    const c = num(r.cost);
    const imp = num(r.impressions);
    const clk = num(r.clicks);
    const rch = num(r.reach);
    cost += c;
    impressions += imp;
    clicks += clk;
    reach += rch;

    const campKey = (r.campaign_id || r.campaign_name || "unknown").trim() || "unknown";
    const campLabel = (r.campaign_name || campKey).trim() || campKey;
    const camp =
      campMap.get(campKey) ??
      ({
        key: campKey,
        label: campLabel,
        cost: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
      } satisfies KakaoMomentCampaignRankRow);
    camp.cost += c;
    camp.impressions += imp;
    camp.clicks += clk;
    campMap.set(campKey, camp);

    return {
      key: `${r.creative_id ?? "c"}-${i}`,
      creativeName: r.creative_name || "(이름 없음)",
      campaignName: r.campaign_name || "—",
      cost: c,
      impressions: imp,
      clicks: clk,
      ctr: imp > 0 ? clk / imp : 0,
      cpc: clk > 0 ? c / clk : 0,
    };
  });

  const campaigns = [...campMap.values()]
    .map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
      cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
    }))
    .sort((a, b) => b.cost - a.cost || b.clicks - a.clicks)
    .slice(0, TOP_N);

  creatives.sort((a, b) => b.cost - a.cost || b.clicks - a.clicks);

  return {
    cost,
    impressions,
    clicks,
    reach,
    campaigns,
    creatives: creatives.slice(0, TOP_N),
  };
}

export async function listKakaoMomentImports(): Promise<KakaoMomentImportListItem[]> {
  const { data: imports, error } = await supabaseAdmin
    .from("kakao_moment_imports")
    .select("id, period_start, period_end, filename, uploaded_by, created_at")
    .order("period_end", { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);
  if (!imports?.length) return [];

  const ids = imports.map((r) => r.id as string);
  const { data: creatives, error: cErr } = await supabaseAdmin
    .from("kakao_moment_creatives")
    .select("import_id, cost, clicks, impressions")
    .in("import_id", ids);

  if (cErr) throw new Error(cErr.message);

  const byImport = new Map<string, { count: number; cost: number; clicks: number; impressions: number }>();
  for (const row of creatives ?? []) {
    const id = String(row.import_id);
    const bucket = byImport.get(id) ?? { count: 0, cost: 0, clicks: 0, impressions: 0 };
    bucket.count += 1;
    bucket.cost += num(row.cost);
    bucket.clicks += num(row.clicks);
    bucket.impressions += num(row.impressions);
    byImport.set(id, bucket);
  }

  return imports.map((row) => {
    const agg = byImport.get(row.id as string) ?? { count: 0, cost: 0, clicks: 0, impressions: 0 };
    return {
      id: row.id as string,
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      filename: String(row.filename ?? ""),
      uploadedBy: (row.uploaded_by as string | null) ?? null,
      createdAt: String(row.created_at),
      creativeCount: agg.count,
      totalCost: agg.cost,
      totalClicks: agg.clicks,
      totalImpressions: agg.impressions,
    };
  });
}

export async function applyKakaoMomentCsv(input: {
  csvText: string;
  periodStart: string;
  periodEnd: string;
  filename: string;
  uploadedBy: string | null;
}): Promise<{ importId: string; summary: KakaoMomentParseResult["summary"] }> {
  const { periodStart, periodEnd } = input;
  if (!isYmd(periodStart) || !isYmd(periodEnd)) {
    throw new Error("periodStart/periodEnd는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (periodEnd < periodStart) {
    throw new Error("periodEnd는 periodStart 이상이어야 합니다.");
  }

  const parsed = parseKakaoMomentCreativeCsv(input.csvText);

  // 동일 기간 기존 배치 삭제 (unique 교체)
  const { error: delErr } = await supabaseAdmin
    .from("kakao_moment_imports")
    .delete()
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);
  if (delErr) throw new Error(delErr.message);

  const { data: imp, error: insErr } = await supabaseAdmin
    .from("kakao_moment_imports")
    .insert({
      period_start: periodStart,
      period_end: periodEnd,
      filename: input.filename.slice(0, 240) || "moment.csv",
      uploaded_by: input.uploadedBy,
    })
    .select("id")
    .single();

  if (insErr || !imp) throw new Error(insErr?.message ?? "임포트 생성 실패");

  const importId = imp.id as string;
  const chunkSize = 200;
  for (let i = 0; i < parsed.rows.length; i += chunkSize) {
    const slice = parsed.rows.slice(i, i + chunkSize);
    const payload = slice.map((r: KakaoMomentCreativeRow) => ({
      import_id: importId,
      creative_name: r.creativeName,
      creative_id: r.creativeId,
      status: r.status,
      ad_group_name: r.adGroupName,
      ad_group_id: r.adGroupId,
      campaign_name: r.campaignName,
      campaign_id: r.campaignId,
      cost: r.cost,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      reach: r.reach,
      cpc: r.cpc,
    }));
    const { error } = await supabaseAdmin.from("kakao_moment_creatives").insert(payload);
    if (error) throw new Error(error.message);
  }

  return { importId, summary: parsed.summary };
}

async function countBizboardLeadsInPeriod(periodStart: string, periodEnd: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("golf_tour_leads")
    .select("id", { count: "exact", head: true })
    .eq("utm_source", "kakao")
    .eq("utm_medium", "bizboard")
    .gte("created_at", periodStartIso(periodStart))
    .lt("created_at", periodEndExclusiveIso(periodEnd));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countKakaoSignupsInPeriod(periodStart: string, periodEnd: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "kakao_signup_new")
    .gte("occurred_at", periodStartIso(periodStart))
    .lt("occurred_at", periodEndExclusiveIso(periodEnd));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * 최근 임포트(또는 importId)로 Moment 효율 블록 구성.
 * CPA는 광고 기간과 동일 구간의 온사이트 리드/가입으로 계산.
 */
export async function fetchKakaoMomentAnalyticsBlock(importId?: string | null): Promise<KakaoMomentAnalyticsBlock | null> {
  let importQuery = supabaseAdmin
    .from("kakao_moment_imports")
    .select("id, period_start, period_end, filename, created_at")
    .order("period_end", { ascending: false })
    .limit(1);

  if (importId) {
    importQuery = supabaseAdmin
      .from("kakao_moment_imports")
      .select("id, period_start, period_end, filename, created_at")
      .eq("id", importId)
      .limit(1);
  }

  const { data: imports, error: iErr } = await importQuery;
  if (iErr) throw new Error(iErr.message);
  const imp = imports?.[0];
  if (!imp) return null;

  const periodStart = String(imp.period_start);
  const periodEnd = String(imp.period_end);

  const { data: creatives, error: cErr } = await supabaseAdmin
    .from("kakao_moment_creatives")
    .select(
      "creative_name, creative_id, status, ad_group_name, ad_group_id, campaign_name, campaign_id, cost, impressions, clicks, ctr, reach, cpc",
    )
    .eq("import_id", imp.id);

  if (cErr) throw new Error(cErr.message);

  const agg = aggregateCreatives((creatives ?? []) as CreativeDbRow[]);
  const [bizboardLeadsInPeriod, newSignupsInPeriod] = await Promise.all([
    countBizboardLeadsInPeriod(periodStart, periodEnd),
    countKakaoSignupsInPeriod(periodStart, periodEnd),
  ]);

  const cpaLead = bizboardLeadsInPeriod > 0 ? agg.cost / bizboardLeadsInPeriod : null;
  const cpaSignup = newSignupsInPeriod > 0 ? agg.cost / newSignupsInPeriod : null;

  return {
    importId: imp.id as string,
    periodStart,
    periodEnd,
    filename: String(imp.filename ?? ""),
    summary: {
      cost: agg.cost,
      impressions: agg.impressions,
      clicks: agg.clicks,
      ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
      cpc: agg.clicks > 0 ? agg.cost / agg.clicks : 0,
      reach: agg.reach,
      bizboardLeadsInPeriod,
      newSignupsInPeriod,
      cpaLead,
      cpaSignup,
    },
    campaigns: agg.campaigns,
    creatives: agg.creatives,
  };
}
