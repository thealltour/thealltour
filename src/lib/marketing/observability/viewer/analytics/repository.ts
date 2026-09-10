import "server-only";

import {
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_TRACES_TABLE,
} from "@/lib/marketing/observability/persistence/types";
import type { MarketingObsDbClient } from "@/lib/marketing/observability/persistence/store";
import { aggregateMarketingObservabilityAnalytics } from "@/lib/marketing/observability/viewer/analytics/aggregate";
import {
  resolveMarketingObsAnalyticsWindow,
  type MarketingObsAnalyticsRange,
} from "@/lib/marketing/observability/viewer/analytics/range";
import type {
  AnalyticsSpanInput,
  AnalyticsTraceInput,
  MarketingObservabilityAnalyticsDto,
} from "@/lib/marketing/observability/viewer/analytics/types";

const MAX_TRACES = 2_000;
const SPAN_IN_BATCH = 100;

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function mapTrace(row: Record<string, unknown>): AnalyticsTraceInput {
  return {
    traceId: String(row.trace_id),
    traceType: String(row.trace_type ?? ""),
    status: String(row.status ?? ""),
    startedAt: String(row.started_at),
    endedAt: (row.ended_at as string | null) ?? null,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
    attributes: (row.attributes as Record<string, unknown>) ?? {},
  };
}

function mapSpan(row: Record<string, unknown>): AnalyticsSpanInput {
  return {
    traceId: String(row.trace_id),
    spanId: String(row.span_id),
    name: String(row.name ?? ""),
    stage: String(row.stage ?? ""),
    kind: String(row.kind ?? ""),
    attempt: typeof row.attempt === "number" ? row.attempt : 1,
    status: String(row.business_status ?? ""),
    otelStatusCode: String(row.otel_status_code ?? "UNSET"),
    startedAt: String(row.started_at),
    endedAt: (row.ended_at as string | null) ?? null,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    errorClass: (row.error_class as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
  };
}

export type MarketingObsAnalyticsRepository = {
  getSummary: (range: MarketingObsAnalyticsRange) => Promise<MarketingObservabilityAnalyticsDto>;
};

/**
 * Server-side analytics: range filter in DB, aggregate in application.
 * No materialized view. Service-role client only.
 */
export function createMarketingObsAnalyticsRepository(
  client: MarketingObsDbClient,
): MarketingObsAnalyticsRepository {
  return {
    async getSummary(range) {
      const window = resolveMarketingObsAnalyticsWindow(range);
      const traceRes = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select(
          "trace_id,trace_type,status,started_at,ended_at,duration_ms,attributes",
        )
        .gte("started_at", window.startIso)
        .lt("started_at", window.endIso)
        .order("started_at", { ascending: false })
        .limit(MAX_TRACES);

      if (traceRes.error) throw new Error(traceRes.error.message);
      const traces = asRows(traceRes.data).map(mapTrace);
      const ids = traces.map((t) => t.traceId);

      const spans: AnalyticsSpanInput[] = [];
      for (let i = 0; i < ids.length; i += SPAN_IN_BATCH) {
        const batch = ids.slice(i, i + SPAN_IN_BATCH);
        if (batch.length === 0) continue;
        const spanRes = await client
          .from(MARKETING_OBS_SPANS_TABLE)
          .select(
            "trace_id,span_id,name,stage,kind,attempt,business_status,otel_status_code,started_at,ended_at,duration_ms,attributes,error_class,error_code,error_message",
          )
          .in("trace_id", batch);
        if (spanRes.error) throw new Error(spanRes.error.message);
        spans.push(...asRows(spanRes.data).map(mapSpan));
      }

      return aggregateMarketingObservabilityAnalytics({
        range: window.range,
        startAt: window.startIso,
        endAt: window.endIso,
        traces,
        spans,
      });
    },
  };
}
