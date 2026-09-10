import type {
  MarketingSpan,
  MarketingSpanActorType,
  MarketingSpanAttributes,
  MarketingSpanKind,
  MarketingSpanStage,
  MarketingSpanStatus,
  MarketingTrace,
  MarketingTraceStatus,
  MarketingTraceType,
  MarketingOtelStatusCode,
} from "@/lib/marketing/observability/types";
import { MARKETING_SPAN_CONTRACT, MARKETING_TRACE_CONTRACT } from "@/lib/marketing/observability/types";
import type { MarketingTraceErrorClass } from "@/lib/marketing/observability/errors";
import { computeDurationMs } from "@/lib/marketing/observability/validate";

export const MARKETING_OBS_TRACES_TABLE = "marketing_observability_traces";
export const MARKETING_OBS_SPANS_TABLE = "marketing_observability_spans";
export const MARKETING_OBS_SCHEMA_VERSION = "1";

export type MarketingTraceRow = {
  trace_id: string;
  schema_version: string;
  trace_type: string;
  status: string;
  production_request_id: string | null;
  logical_run_key: string | null;
  agenda_slate_id: string | null;
  agenda_candidate_id: string | null;
  assignment_id: string | null;
  completed_candidate_id: string | null;
  hmr_id: string | null;
  run_id: string | null;
  correlation_id: string | null;
  research_brief_id: string | null;
  governance_review_id: string | null;
  business_date_kst: string | null;
  root_span_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  attributes: MarketingSpanAttributes;
  created_at?: string;
  updated_at?: string;
};

export type MarketingSpanRow = {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  schema_version: string;
  name: string;
  kind: string;
  actor_type: string;
  actor_id: string | null;
  stage: string;
  attempt: number;
  business_status: string;
  otel_status_code: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  attributes: MarketingSpanAttributes;
  error_class: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
};

const TERMINAL_SPAN_STATUSES = new Set<string>([
  "ok",
  "error",
  "skipped",
  "revision_required",
  "blocked",
]);

const TERMINAL_TRACE_STATUSES = new Set<string>(["completed", "failed", "partial"]);

export function isTerminalSpanStatus(status: string): boolean {
  return TERMINAL_SPAN_STATUSES.has(status);
}

export function isTerminalTraceStatus(status: string): boolean {
  return TERMINAL_TRACE_STATUSES.has(status);
}

export function traceToRow(
  trace: MarketingTrace,
  attributes: MarketingSpanAttributes = {},
): MarketingTraceRow {
  const endedAt = trace.endedAt ?? null;
  return {
    trace_id: trace.traceId,
    schema_version: MARKETING_OBS_SCHEMA_VERSION,
    trace_type: trace.traceType,
    status: trace.status,
    production_request_id: trace.productionRequestId ?? null,
    logical_run_key: trace.logicalRunKey ?? null,
    agenda_slate_id: trace.agendaSlateId ?? null,
    agenda_candidate_id: trace.agendaCandidateId ?? null,
    assignment_id: trace.assignmentId ?? null,
    completed_candidate_id: trace.candidateId ?? null,
    hmr_id: trace.reviewId ?? null,
    run_id: trace.runId ?? null,
    correlation_id: trace.correlationId ?? null,
    research_brief_id: trace.researchBriefId ?? null,
    governance_review_id: trace.governanceReviewId ?? null,
    business_date_kst: trace.businessDateKst ?? null,
    root_span_id: trace.rootSpanId ?? null,
    started_at: trace.startedAt,
    ended_at: endedAt,
    duration_ms: endedAt ? computeDurationMs(trace.startedAt, endedAt) : null,
    attributes,
  };
}

export function spanToRow(span: MarketingSpan): MarketingSpanRow {
  return {
    trace_id: span.traceId,
    span_id: span.spanId,
    parent_span_id: span.parentSpanId ?? null,
    schema_version: MARKETING_OBS_SCHEMA_VERSION,
    name: span.name,
    kind: span.kind,
    actor_type: span.actorType,
    actor_id: span.actorId ?? null,
    stage: span.stage,
    attempt: span.attempt,
    business_status: span.status,
    otel_status_code: span.otelStatusCode ?? "UNSET",
    started_at: span.startedAt,
    ended_at: span.endedAt ?? null,
    duration_ms: span.durationMs ?? null,
    attributes: span.attributes ?? {},
    error_class: span.error?.class ?? null,
    error_code: span.error?.pipelineFailureCode ?? null,
    error_message: span.error?.message ?? null,
  };
}

export function rowToTrace(row: MarketingTraceRow, spans?: MarketingSpan[]): MarketingTrace {
  return {
    contract: MARKETING_TRACE_CONTRACT,
    traceId: row.trace_id,
    traceType: row.trace_type as MarketingTraceType,
    status: row.status as MarketingTraceStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    rootSpanId: row.root_span_id,
    productionRequestId: row.production_request_id,
    logicalRunKey: row.logical_run_key,
    agendaSlateId: row.agenda_slate_id,
    agendaCandidateId: row.agenda_candidate_id,
    assignmentId: row.assignment_id,
    candidateId: row.completed_candidate_id,
    reviewId: row.hmr_id,
    runId: row.run_id,
    correlationId: row.correlation_id,
    researchBriefId: row.research_brief_id,
    governanceReviewId: row.governance_review_id,
    businessDateKst: row.business_date_kst,
    spans,
  };
}

export function rowToSpan(row: MarketingSpanRow): MarketingSpan {
  return {
    contract: MARKETING_SPAN_CONTRACT,
    spanId: row.span_id,
    traceId: row.trace_id,
    parentSpanId: row.parent_span_id,
    name: row.name,
    kind: row.kind as MarketingSpanKind,
    actorType: row.actor_type as MarketingSpanActorType,
    actorId: row.actor_id,
    stage: row.stage as MarketingSpanStage,
    attempt: row.attempt,
    status: row.business_status as MarketingSpanStatus,
    otelStatusCode: row.otel_status_code as MarketingOtelStatusCode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    attributes: (row.attributes ?? {}) as MarketingSpanAttributes,
    error:
      row.error_class || row.error_message
        ? {
            class: (row.error_class as MarketingTraceErrorClass) ?? "unknown",
            message: row.error_message ?? row.error_class ?? "error",
            pipelineFailureCode: row.error_code,
          }
        : null,
  };
}
