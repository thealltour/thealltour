import { asNumber, asString } from "@/lib/marketing/context/json";
import type { MetricSummary, PerformanceSummary } from "@/lib/marketing/context/types";

export type AiFeedbackRow = {
  publication_id?: unknown;
  channel?: unknown;
  metric_type?: unknown;
  metric_value?: unknown;
  measured_at?: unknown;
};

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
