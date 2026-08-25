import { asNumber, asString } from "@/lib/marketing/context/json";
import type { MetricSummary, PerformanceSummary } from "@/lib/marketing/context/types";

export type AiFeedbackRow = {
  publication_id?: unknown;
  channel?: unknown;
  metric_type?: unknown;
  metric_value?: unknown;
  measured_at?: unknown;
};

const RATIO_METRIC_TYPES = new Set(["ctr", "cpc", "cpm", "cvr", "rate"]);

export function normalizeMetricType(value: unknown): string {
  return (asString(value) ?? "unknown").toLowerCase();
}

export function isSummableMetricType(metricType: string): boolean {
  return !RATIO_METRIC_TYPES.has(metricType.toLowerCase());
}

function metricKey(row: AiFeedbackRow): string {
  return `${asString(row.publication_id) ?? "_"}\0${normalizeMetricType(row.metric_type)}`;
}

/** Keep the latest snapshot per publication + metric_type so time series rows are not summed twice. */
export function collapseLatestFeedbackRows(rows: AiFeedbackRow[]): AiFeedbackRow[] {
  const latest = new Map<string, AiFeedbackRow>();
  for (const row of rows) {
    const key = metricKey(row);
    const measuredAt = asString(row.measured_at) ?? "";
    const existing = latest.get(key);
    if (!existing || (asString(existing.measured_at) ?? "") < measuredAt) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

export function sumFeedbackMetrics(rows: AiFeedbackRow[]): MetricSummary[] {
  const sums = new Map<string, { value: number; measuredAt: string | null }>();
  for (const row of collapseLatestFeedbackRows(rows)) {
    const metricType = normalizeMetricType(row.metric_type);
    if (!isSummableMetricType(metricType) || metricType === "unknown") continue;
    const value = asNumber(row.metric_value) ?? 0;
    const prev = sums.get(metricType);
    sums.set(metricType, {
      value: (prev?.value ?? 0) + value,
      measuredAt: asString(row.measured_at) ?? prev?.measuredAt ?? null,
    });
  }
  return [...sums.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([metricType, item]) => ({
      metricType,
      value: item.value,
      change: null,
      measuredAt: item.measuredAt,
    }));
}

const INQUIRY_ALIASES = new Set(["inquiries", "inquiry_count"]);
const BOOKING_ALIASES = new Set(["bookings", "booking_count"]);

export function hasMetricType(metrics: MetricSummary[], metricType: string): boolean {
  const type = metricType.toLowerCase();
  const types = new Set(metrics.map((item) => item.metricType.toLowerCase()));
  if (types.has(type)) return true;
  if (INQUIRY_ALIASES.has(type) && [...types].some((item) => INQUIRY_ALIASES.has(item))) return true;
  if (BOOKING_ALIASES.has(type) && [...types].some((item) => BOOKING_ALIASES.has(item))) return true;
  return false;
}

export function mergeMetricsWithoutDuplicate(
  primary: MetricSummary[],
  extra: MetricSummary[],
): MetricSummary[] {
  return [
    ...primary,
    ...extra.filter((item) => !hasMetricType(primary, item.metricType)),
  ];
}

export function topPublicationIdsByMetric(
  rows: AiFeedbackRow[],
  metricType: string,
  limit: number,
): string[] {
  const collapsed = collapseLatestFeedbackRows(rows).filter(
    (row) => normalizeMetricType(row.metric_type) === metricType.toLowerCase(),
  );
  return collapsed
    .map((row) => ({
      publicationId: asString(row.publication_id),
      value: asNumber(row.metric_value) ?? 0,
    }))
    .filter((item): item is { publicationId: string; value: number } => Boolean(item.publicationId))
    .sort((a, b) => b.value - a.value || a.publicationId.localeCompare(b.publicationId))
    .slice(0, limit)
    .map((item) => item.publicationId);
}

export function mapPerformanceSummary(input: {
  period: { start: string; end: string };
  channel: string | null;
  productId: string | null;
  publicationCount: number;
  rows: AiFeedbackRow[];
  additionalMetrics?: MetricSummary[];
}): PerformanceSummary {
  const metrics: MetricSummary[] = [
    ...input.rows.map((row) => ({
      metricType: asString(row.metric_type) ?? "unknown",
      value: asNumber(row.metric_value) ?? 0,
      change: null,
      measuredAt: asString(row.measured_at),
    })),
    ...(input.additionalMetrics ?? []),
  ];

  return {
    period: input.period,
    channel: input.channel,
    productId: input.productId,
    publicationCount: input.publicationCount,
    metrics,
    topPerformingContent: [],
    bottomPerformingContent: [],
    topAgendas: [],
    conversionSummary: null,
  };
}
