import type {
  MarketingSpan,
  MarketingSpanStatus,
  MarketingTrace,
  MarketingOtelStatusCode,
} from "@/lib/marketing/observability/types";
import { isValidSpanId, isValidTraceId } from "@/lib/marketing/observability/ids";

export type TraceValidationIssue = {
  code:
    | "invalid_trace_id"
    | "invalid_span_id"
    | "trace_span_mismatch"
    | "orphan_parent"
    | "invalid_timestamps"
    | "negative_duration"
    | "missing_root"
    | "cycle";
  message: string;
  spanId?: string;
};

export function otelStatusFromSpanStatus(status: MarketingSpanStatus): MarketingOtelStatusCode {
  if (status === "running") return "UNSET";
  // Completeness revision_required / GA blocked are successful validator/governance runs.
  if (
    status === "ok" ||
    status === "skipped" ||
    status === "revision_required" ||
    status === "blocked"
  ) {
    return "OK";
  }
  if (status === "error") return "ERROR";
  return "UNSET";
}

function parseIsoMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function validateSpanTimestamps(span: MarketingSpan): TraceValidationIssue[] {
  const issues: TraceValidationIssue[] = [];
  const start = parseIsoMs(span.startedAt);
  if (start === null) {
    issues.push({
      code: "invalid_timestamps",
      message: "startedAt is not a valid ISO timestamp",
      spanId: span.spanId,
    });
    return issues;
  }
  if (span.endedAt) {
    const end = parseIsoMs(span.endedAt);
    if (end === null) {
      issues.push({
        code: "invalid_timestamps",
        message: "endedAt is not a valid ISO timestamp",
        spanId: span.spanId,
      });
    } else if (end < start) {
      issues.push({
        code: "invalid_timestamps",
        message: "endedAt precedes startedAt",
        spanId: span.spanId,
      });
    }
  }
  if (typeof span.durationMs === "number" && span.durationMs < 0) {
    issues.push({
      code: "negative_duration",
      message: "durationMs must be >= 0",
      spanId: span.spanId,
    });
  }
  return issues;
}

/**
 * Validate parent/child hierarchy and id formats for an in-memory trace envelope.
 */
export function validateMarketingTrace(trace: MarketingTrace): TraceValidationIssue[] {
  const issues: TraceValidationIssue[] = [];
  if (!isValidTraceId(trace.traceId)) {
    issues.push({ code: "invalid_trace_id", message: "traceId must be 32 lowercase hex chars" });
  }

  const spans = trace.spans ?? [];
  const byId = new Map(spans.map((s) => [s.spanId, s]));

  if (trace.rootSpanId && !byId.has(trace.rootSpanId) && spans.length > 0) {
    issues.push({
      code: "missing_root",
      message: `rootSpanId ${trace.rootSpanId} not found in spans`,
    });
  }

  for (const span of spans) {
    if (!isValidSpanId(span.spanId)) {
      issues.push({
        code: "invalid_span_id",
        message: "spanId must be 16 lowercase hex chars",
        spanId: span.spanId,
      });
    }
    if (span.traceId !== trace.traceId) {
      issues.push({
        code: "trace_span_mismatch",
        message: "span.traceId does not match trace.traceId",
        spanId: span.spanId,
      });
    }
    if (span.parentSpanId) {
      if (!isValidSpanId(span.parentSpanId)) {
        issues.push({
          code: "invalid_span_id",
          message: "parentSpanId must be 16 lowercase hex chars",
          spanId: span.spanId,
        });
      } else if (!byId.has(span.parentSpanId)) {
        issues.push({
          code: "orphan_parent",
          message: `parentSpanId ${span.parentSpanId} not found`,
          spanId: span.spanId,
        });
      }
    }
    issues.push(...validateSpanTimestamps(span));
  }

  // Detect simple parent cycles
  for (const span of spans) {
    const seen = new Set<string>();
    let current: string | null | undefined = span.spanId;
    while (current) {
      if (seen.has(current)) {
        issues.push({ code: "cycle", message: "parent chain contains a cycle", spanId: span.spanId });
        break;
      }
      seen.add(current);
      current = byId.get(current)?.parentSpanId;
    }
  }

  return issues;
}

export function computeDurationMs(startedAt: string, endedAt: string): number | null {
  const start = parseIsoMs(startedAt);
  const end = parseIsoMs(endedAt);
  if (start === null || end === null || end < start) return null;
  return end - start;
}
