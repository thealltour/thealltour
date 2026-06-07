import {
  GOLF_LEAD_SOURCE_LABELS,
  inferGolfLeadSourceKind,
  type GolfLeadSourceKind,
} from "@/lib/leads/golfLeadContext";

export type GolfLeadStatsRow = {
  id: string;
  reference_id: string;
  customer_name: string;
  phone_number: string;
  group_size: number | null;
  target_destination: string | null;
  landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  acquisition_channel: string | null;
  status: string;
  actual_revenue: number;
  created_at: string;
};

export type GolfLeadCountItem = {
  key: string;
  label: string;
  count: number;
};

export type GolfLeadDailyTrendItem = {
  date: string;
  count: number;
  revenue: number;
};

export type GolfLeadsSummary = {
  total: number;
  totalActualRevenue: number;
  averageGroupSize: number | null;
  byChannel: GolfLeadCountItem[];
  byStatus: GolfLeadCountItem[];
  bySourceKind: GolfLeadCountItem[];
  byUtmSource: GolfLeadCountItem[];
  byUtmCampaign: GolfLeadCountItem[];
  byLandingPage: GolfLeadCountItem[];
  dailyTrend: GolfLeadDailyTrendItem[];
};

export type GolfLeadsListResponse = {
  leads: GolfLeadStatsRow[];
  summary: GolfLeadsSummary;
  period: {
    range: string;
    startIso: string | null;
    endIso: string | null;
  };
};

export function normalizeGolfLeadRow(row: Record<string, unknown>): GolfLeadStatsRow {
  const revenueRaw = row.actual_revenue;
  const actualRevenue =
    typeof revenueRaw === "number"
      ? revenueRaw
      : typeof revenueRaw === "string"
        ? Number.parseFloat(revenueRaw) || 0
        : 0;

  return {
    id: String(row.id ?? ""),
    reference_id: String(row.reference_id ?? ""),
    customer_name: String(row.customer_name ?? ""),
    phone_number: String(row.phone_number ?? ""),
    group_size: typeof row.group_size === "number" ? row.group_size : null,
    target_destination:
      typeof row.target_destination === "string" && row.target_destination.trim()
        ? row.target_destination
        : null,
    landing_page:
      typeof row.landing_page === "string" && row.landing_page.trim() ? row.landing_page : null,
    utm_source: typeof row.utm_source === "string" && row.utm_source.trim() ? row.utm_source : null,
    utm_medium: typeof row.utm_medium === "string" && row.utm_medium.trim() ? row.utm_medium : null,
    utm_campaign:
      typeof row.utm_campaign === "string" && row.utm_campaign.trim() ? row.utm_campaign : null,
    utm_term: typeof row.utm_term === "string" && row.utm_term.trim() ? row.utm_term : null,
    utm_content:
      typeof row.utm_content === "string" && row.utm_content.trim() ? row.utm_content : null,
    acquisition_channel:
      typeof row.acquisition_channel === "string" && row.acquisition_channel.trim()
        ? row.acquisition_channel
        : null,
    status: String(row.status ?? "PENDING"),
    actual_revenue: actualRevenue,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

function countByKey(
  rows: GolfLeadStatsRow[],
  pick: (row: GolfLeadStatsRow) => string | null | undefined,
  labelFn?: (key: string) => string,
  limit = 12,
): GolfLeadCountItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = pick(row)?.trim() || "unknown";
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: labelFn ? labelFn(key) : key,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function kstDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildGolfLeadsSummary(rows: GolfLeadStatsRow[]): GolfLeadsSummary {
  const groupSizes = rows.map((r) => r.group_size).filter((n): n is number => typeof n === "number" && n > 0);
  const averageGroupSize =
    groupSizes.length > 0
      ? Math.round((groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length) * 10) / 10
      : null;

  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (const row of rows) {
    const date = kstDateKey(row.created_at);
    const prev = dailyMap.get(date) ?? { count: 0, revenue: 0 };
    dailyMap.set(date, {
      count: prev.count + 1,
      revenue: prev.revenue + row.actual_revenue,
    });
  }

  return {
    total: rows.length,
    totalActualRevenue: rows.reduce((sum, row) => sum + row.actual_revenue, 0),
    averageGroupSize,
    byChannel: countByKey(rows, (r) => r.acquisition_channel),
    byStatus: countByKey(rows, (r) => r.status),
    bySourceKind: countByKey(rows, (r) => inferGolfLeadSourceKind(r.landing_page), (key) =>
      GOLF_LEAD_SOURCE_LABELS[key as GolfLeadSourceKind] ?? key,
    ),
    byUtmSource: countByKey(rows, (r) => r.utm_source),
    byUtmCampaign: countByKey(rows, (r) => r.utm_campaign),
    byLandingPage: countByKey(rows, (r) => r.landing_page, undefined, 10),
    dailyTrend: [...dailyMap.entries()]
      .map(([date, v]) => ({ date, count: v.count, revenue: v.revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function parseGolfLeadsDateRange(range: string | null): {
  startIso: string | null;
  endIso: string | null;
  rangeLabel: string;
} {
  const r = (range ?? "30d").toLowerCase().trim();
  if (r === "all") {
    return { startIso: null, endIso: null, rangeLabel: "all" };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const endIso = tomorrowStart.toISOString();

  if (r === "7d") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { startIso: start.toISOString(), endIso, rangeLabel: "7d" };
  }
  if (r === "today") {
    return { startIso: todayStart.toISOString(), endIso, rangeLabel: "today" };
  }

  const start = new Date(todayStart);
  start.setDate(start.getDate() - 29);
  return { startIso: start.toISOString(), endIso, rangeLabel: "30d" };
}
