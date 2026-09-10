import {
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_TRACES_TABLE,
  type MarketingSpanRow,
  type MarketingTraceRow,
} from "@/lib/marketing/observability/persistence/types";
import {
  isTerminalSpanStatus,
  isTerminalTraceStatus,
} from "@/lib/marketing/observability/persistence/types";
import type {
  MarketingObsDbClient,
  MarketingTraceStore,
} from "@/lib/marketing/observability/persistence/store";

function asRow(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function mapTrace(row: Record<string, unknown>): MarketingTraceRow {
  return {
    trace_id: String(row.trace_id),
    schema_version: String(row.schema_version ?? "1"),
    trace_type: String(row.trace_type),
    status: String(row.status),
    production_request_id: (row.production_request_id as string | null) ?? null,
    logical_run_key: (row.logical_run_key as string | null) ?? null,
    agenda_slate_id: (row.agenda_slate_id as string | null) ?? null,
    agenda_candidate_id: (row.agenda_candidate_id as string | null) ?? null,
    assignment_id: (row.assignment_id as string | null) ?? null,
    completed_candidate_id: (row.completed_candidate_id as string | null) ?? null,
    hmr_id: (row.hmr_id as string | null) ?? null,
    run_id: (row.run_id as string | null) ?? null,
    correlation_id: (row.correlation_id as string | null) ?? null,
    research_brief_id: (row.research_brief_id as string | null) ?? null,
    governance_review_id: (row.governance_review_id as string | null) ?? null,
    business_date_kst: (row.business_date_kst as string | null) ?? null,
    root_span_id: (row.root_span_id as string | null) ?? null,
    started_at: String(row.started_at),
    ended_at: (row.ended_at as string | null) ?? null,
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : null,
    attributes: (row.attributes as MarketingTraceRow["attributes"]) ?? {},
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapSpan(row: Record<string, unknown>): MarketingSpanRow {
  return {
    trace_id: String(row.trace_id),
    span_id: String(row.span_id),
    parent_span_id: (row.parent_span_id as string | null) ?? null,
    schema_version: String(row.schema_version ?? "1"),
    name: String(row.name),
    kind: String(row.kind),
    actor_type: String(row.actor_type),
    actor_id: (row.actor_id as string | null) ?? null,
    stage: String(row.stage),
    attempt: typeof row.attempt === "number" ? row.attempt : 1,
    business_status: String(row.business_status),
    otel_status_code: String(row.otel_status_code ?? "UNSET"),
    started_at: String(row.started_at),
    ended_at: (row.ended_at as string | null) ?? null,
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : null,
    attributes: (row.attributes as MarketingSpanRow["attributes"]) ?? {},
    error_class: (row.error_class as string | null) ?? null,
    error_code: (row.error_code as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function createSupabaseMarketingTraceStore(
  client: MarketingObsDbClient,
): MarketingTraceStore {
  return {
    async upsertTrace(row) {
      const existingRes = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select("*")
        .eq("trace_id", row.trace_id)
        .maybeSingle();
      const existing = existingRes.data ? mapTrace(asRow(existingRes.data) ?? {}) : null;
      if (existing && isTerminalTraceStatus(existing.status) && row.status === "running") {
        return;
      }
      const result = await client.from(MARKETING_OBS_TRACES_TABLE).upsert(
        {
          ...row,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trace_id" },
      );
      if (result.error) throw new Error(result.error.message);
    },

    async updateTrace(traceId, patch) {
      const existingRes = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select("*")
        .eq("trace_id", traceId)
        .maybeSingle();
      const existing = existingRes.data ? mapTrace(asRow(existingRes.data) ?? {}) : null;
      if (!existing) return;
      if (isTerminalTraceStatus(existing.status) && patch.status === "running") return;

      const result = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("trace_id", traceId);
      if (result.error) throw new Error(result.error.message);
    },

    async upsertSpan(row) {
      const existingRes = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .select("*")
        .eq("trace_id", row.trace_id)
        .eq("span_id", row.span_id)
        .maybeSingle();
      const existing = existingRes.data ? mapSpan(asRow(existingRes.data) ?? {}) : null;
      if (existing && isTerminalSpanStatus(existing.business_status) && row.business_status === "running") {
        return;
      }
      const payload =
        existing && isTerminalSpanStatus(existing.business_status)
          ? {
              ...row,
              business_status: existing.business_status,
              otel_status_code: existing.otel_status_code,
              ended_at: existing.ended_at ?? row.ended_at,
              duration_ms: existing.duration_ms ?? row.duration_ms,
              updated_at: new Date().toISOString(),
            }
          : { ...row, updated_at: new Date().toISOString() };

      const result = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .upsert(payload, { onConflict: "trace_id,span_id" });
      if (result.error) throw new Error(result.error.message);
    },

    async updateSpan(traceId, spanId, patch) {
      const existingRes = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .select("*")
        .eq("trace_id", traceId)
        .eq("span_id", spanId)
        .maybeSingle();
      const existing = existingRes.data ? mapSpan(asRow(existingRes.data) ?? {}) : null;
      if (!existing) return;
      if (isTerminalSpanStatus(existing.business_status) && patch.business_status === "running") {
        return;
      }

      const result = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("trace_id", traceId)
        .eq("span_id", spanId);
      if (result.error) throw new Error(result.error.message);
    },

    async getTraceRow(traceId) {
      const result = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select("*")
        .eq("trace_id", traceId)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      const row = asRow(result.data);
      return row ? mapTrace(row) : null;
    },

    async getSpanRow(traceId, spanId) {
      const result = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .select("*")
        .eq("trace_id", traceId)
        .eq("span_id", spanId)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      const row = asRow(result.data);
      return row ? mapSpan(row) : null;
    },

    async listSpanRows(traceId) {
      const result = await client
        .from(MARKETING_OBS_SPANS_TABLE)
        .select("*")
        .eq("trace_id", traceId)
        .order("started_at", { ascending: true });
      if (result.error) throw new Error(result.error.message);
      return asRows(result.data).map(mapSpan);
    },

    async findTraceRowByProductionRequestId(productionRequestId) {
      const result = await client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select("*")
        .eq("production_request_id", productionRequestId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      const row = asRow(result.data);
      return row ? mapTrace(row) : null;
    },

    async listRecentTraceRows(input) {
      let query = client
        .from(MARKETING_OBS_TRACES_TABLE)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(input?.limit ?? 20);
      if (input?.status) {
        query = query.eq("status", input.status);
      }
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      return asRows(result.data).map(mapTrace);
    },
  };
}
