/**
 * Finalize marketing observability traces left in `running` without ended_at.
 * Display-only STALE labels become real terminal rows so the org viewer stays usable.
 */

import {
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_TRACES_TABLE,
} from "@/lib/marketing/observability/persistence/types";
import { DEFAULT_STALE_RUNNING_MS } from "@/lib/marketing/observability/viewer/live/staleRunning";

export type ReapStaleRunningMarketingTracesResult = {
  dryRun: boolean;
  thresholdMs: number;
  staleTraceCount: number;
  tracesReaped: number;
  spansReaped: number;
  traceIds: string[];
};

/** Loose Supabase/PostgREST client (`.is` required for ended_at IS NULL). */
export type ReapStaleDbClient = {
  from: (table: string) => any;
};

export async function reapStaleRunningMarketingTraces(input: {
  client: ReapStaleDbClient;
  thresholdMs?: number;
  limit?: number;
  now?: Date;
  dryRun?: boolean;
}): Promise<ReapStaleRunningMarketingTracesResult> {
  const now = input.now ?? new Date();
  const thresholdMs = input.thresholdMs ?? DEFAULT_STALE_RUNNING_MS;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const dryRun = Boolean(input.dryRun);
  const cutoff = new Date(now.getTime() - thresholdMs).toISOString();
  const nowIso = now.toISOString();

  const listed = await input.client
    .from(MARKETING_OBS_TRACES_TABLE)
    .select("trace_id,status,started_at,ended_at,attributes")
    .eq("status", "running")
    .is("ended_at", null)
    .lt("started_at", cutoff)
    .order("started_at", { ascending: true })
    .limit(limit);
  if (listed.error) throw new Error(listed.error.message);

  const rows = Array.isArray(listed.data) ? listed.data : [];
  const traceIds = rows.map((r: { trace_id: string }) => String(r.trace_id));
  if (dryRun || rows.length === 0) {
    return {
      dryRun,
      thresholdMs,
      staleTraceCount: rows.length,
      tracesReaped: 0,
      spansReaped: 0,
      traceIds,
    };
  }

  let tracesReaped = 0;
  let spansReaped = 0;

  for (const row of rows) {
    const traceId = String(row.trace_id);
    const startedAt = String(row.started_at);
    const startMs = Date.parse(startedAt);
    const durationMs = Number.isFinite(startMs) ? Math.max(0, now.getTime() - startMs) : null;
    const priorAttrs =
      row.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes)
        ? (row.attributes as Record<string, unknown>)
        : {};

    const updated = await input.client
      .from(MARKETING_OBS_TRACES_TABLE)
      .update({
        status: "partial",
        ended_at: nowIso,
        duration_ms: durationMs,
        updated_at: nowIso,
        attributes: {
          ...priorAttrs,
          stale_reaped: true,
          stale_reaped_at: nowIso,
          stale_reap_reason: "running_without_end_past_threshold",
          stale_reap_threshold_ms: thresholdMs,
        },
      })
      .eq("trace_id", traceId)
      .eq("status", "running")
      .is("ended_at", null);
    if (updated.error) throw new Error(updated.error.message);
    tracesReaped += 1;

    const openSpans = await input.client
      .from(MARKETING_OBS_SPANS_TABLE)
      .select("span_id,started_at")
      .eq("trace_id", traceId)
      .eq("business_status", "running")
      .is("ended_at", null);
    if (openSpans.error) throw new Error(openSpans.error.message);

    for (const span of openSpans.data ?? []) {
      const spanStart = Date.parse(String(span.started_at));
      const spanDur = Number.isFinite(spanStart) ? Math.max(0, now.getTime() - spanStart) : null;
      const spanUpdated = await input.client
        .from(MARKETING_OBS_SPANS_TABLE)
        .update({
          business_status: "error",
          otel_status_code: "ERROR",
          ended_at: nowIso,
          duration_ms: spanDur,
          error_class: "stale_reaped",
          error_code: "STALE_RUNNING_REAPED",
          error_message: "Trace left running past stale threshold; finalized by reaper",
          updated_at: nowIso,
        })
        .eq("trace_id", traceId)
        .eq("span_id", span.span_id)
        .eq("business_status", "running")
        .is("ended_at", null);
      if (spanUpdated.error) throw new Error(spanUpdated.error.message);
      spansReaped += 1;
    }
  }

  return {
    dryRun,
    thresholdMs,
    staleTraceCount: rows.length,
    tracesReaped,
    spansReaped,
    traceIds,
  };
}
