import type {
  MarketingSpanRow,
  MarketingTraceRow,
} from "@/lib/marketing/observability/persistence/types";
import {
  isTerminalSpanStatus,
  isTerminalTraceStatus,
} from "@/lib/marketing/observability/persistence/types";
import type { MarketingTraceStore } from "@/lib/marketing/observability/persistence/store";

function nowIso(): string {
  return new Date().toISOString();
}

export function createInMemoryMarketingTraceStore(): MarketingTraceStore & {
  clear(): void;
  snapshotTraces(): MarketingTraceRow[];
  snapshotSpans(): MarketingSpanRow[];
} {
  const traces = new Map<string, MarketingTraceRow>();
  const spans = new Map<string, MarketingSpanRow>(); // key = traceId:spanId

  const spanKey = (traceId: string, spanId: string) => `${traceId}:${spanId}`;

  return {
    async upsertTrace(row) {
      const existing = traces.get(row.trace_id);
      if (existing && isTerminalTraceStatus(existing.status) && row.status === "running") {
        return;
      }
      traces.set(row.trace_id, {
        ...existing,
        ...row,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      });
    },

    async updateTrace(traceId, patch) {
      const existing = traces.get(traceId);
      if (!existing) return;
      if (
        isTerminalTraceStatus(existing.status) &&
        patch.status === "running"
      ) {
        return;
      }
      traces.set(traceId, {
        ...existing,
        ...patch,
        trace_id: existing.trace_id,
        updated_at: nowIso(),
      });
    },

    async upsertSpan(row) {
      const key = spanKey(row.trace_id, row.span_id);
      const existing = spans.get(key);
      if (existing && isTerminalSpanStatus(existing.business_status) && row.business_status === "running") {
        return;
      }
      if (existing && isTerminalSpanStatus(existing.business_status)) {
        // Terminal: allow attribute merge / error fill but not status regression to running
        spans.set(key, {
          ...existing,
          ...row,
          business_status: existing.business_status,
          otel_status_code: existing.otel_status_code,
          ended_at: existing.ended_at ?? row.ended_at,
          duration_ms: existing.duration_ms ?? row.duration_ms,
          created_at: existing.created_at ?? nowIso(),
          updated_at: nowIso(),
        });
        return;
      }
      spans.set(key, {
        ...existing,
        ...row,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      });
    },

    async updateSpan(traceId, spanId, patch) {
      const key = spanKey(traceId, spanId);
      const existing = spans.get(key);
      if (!existing) return;
      if (
        isTerminalSpanStatus(existing.business_status) &&
        patch.business_status === "running"
      ) {
        return;
      }
      if (
        isTerminalSpanStatus(existing.business_status) &&
        patch.business_status &&
        patch.business_status !== existing.business_status
      ) {
        // Do not overwrite a terminal status with a different terminal via regressive path;
        // allow identical re-end (idempotent).
        if (patch.business_status !== existing.business_status) {
          spans.set(key, {
            ...existing,
            attributes: { ...existing.attributes, ...(patch.attributes ?? {}) },
            updated_at: nowIso(),
          });
          return;
        }
      }
      spans.set(key, {
        ...existing,
        ...patch,
        trace_id: existing.trace_id,
        span_id: existing.span_id,
        updated_at: nowIso(),
      });
    },

    async getTraceRow(traceId) {
      return traces.get(traceId) ?? null;
    },

    async getSpanRow(traceId, spanId) {
      return spans.get(spanKey(traceId, spanId)) ?? null;
    },

    async listSpanRows(traceId) {
      return [...spans.values()]
        .filter((s) => s.trace_id === traceId)
        .sort((a, b) => a.started_at.localeCompare(b.started_at));
    },

    async findTraceRowByProductionRequestId(productionRequestId) {
      return (
        [...traces.values()].find((t) => t.production_request_id === productionRequestId) ?? null
      );
    },

    async listRecentTraceRows(input) {
      const limit = input?.limit ?? 20;
      return [...traces.values()]
        .filter((t) => (input?.status ? t.status === input.status : true))
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit);
    },

    clear() {
      traces.clear();
      spans.clear();
    },

    snapshotTraces() {
      return [...traces.values()];
    },

    snapshotSpans() {
      return [...spans.values()];
    },
  };
}
