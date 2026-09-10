import type {
  MarketingSpan,
  MarketingSpanKind,
  MarketingSpanStage,
  MarketingSpanStatus,
  MarketingTrace,
  MarketingTraceCorrelation,
  MarketingTraceStatus,
  MarketingTraceType,
  MarketingSpanActorType,
  MarketingSpanAttributes,
  MarketingSpanError,
} from "@/lib/marketing/observability/types";
import { MARKETING_SPAN_CONTRACT, MARKETING_TRACE_CONTRACT } from "@/lib/marketing/observability/types";
import { createMarketingSpanId, createMarketingTraceId } from "@/lib/marketing/observability/ids";
import { sanitizeSpanAttributes, sanitizeSpanErrorMessage } from "@/lib/marketing/observability/privacy";
import { computeDurationMs, otelStatusFromSpanStatus } from "@/lib/marketing/observability/validate";

export function createMarketingTrace(input: {
  traceType: MarketingTraceType;
  startedAt?: string;
  status?: MarketingTraceStatus;
  correlation?: MarketingTraceCorrelation;
  traceId?: string;
}): MarketingTrace {
  const startedAt = input.startedAt ?? new Date().toISOString();
  return {
    contract: MARKETING_TRACE_CONTRACT,
    traceId: input.traceId ?? createMarketingTraceId(),
    traceType: input.traceType,
    startedAt,
    status: input.status ?? "running",
    productionRequestId: input.correlation?.productionRequestId ?? null,
    logicalRunKey: input.correlation?.logicalRunKey ?? null,
    runId: input.correlation?.runId ?? null,
    correlationId: input.correlation?.correlationId ?? null,
    agendaSlateId: input.correlation?.agendaSlateId ?? null,
    candidateId: input.correlation?.candidateId ?? null,
    assignmentId: input.correlation?.assignmentId ?? null,
    researchBriefId: input.correlation?.researchBriefId ?? null,
    agendaCandidateId: input.correlation?.agendaCandidateId ?? null,
    reviewId: input.correlation?.reviewId ?? null,
    governanceReviewId: input.correlation?.governanceReviewId ?? null,
    spans: [],
  };
}

export function createMarketingSpan(input: {
  traceId: string;
  name: string;
  kind: MarketingSpanKind;
  stage: MarketingSpanStage;
  actorType: MarketingSpanActorType;
  actorId?: string | null;
  parentSpanId?: string | null;
  startedAt?: string;
  endedAt?: string | null;
  status?: MarketingSpanStatus;
  attempt?: number;
  attributes?: MarketingSpanAttributes;
  error?: Omit<MarketingSpanError, "message"> & { message: string };
  spanId?: string;
}): MarketingSpan {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const endedAt = input.endedAt ?? null;
  const status = input.status ?? "running";
  const { attributes, rejectedKeys } = sanitizeSpanAttributes(input.attributes ?? {});
  if (rejectedKeys.length > 0) {
    attributes["marketing.privacy.rejected_attribute_count"] = rejectedKeys.length;
  }

  const error = input.error
    ? {
        ...input.error,
        message: sanitizeSpanErrorMessage(input.error.message),
      }
    : null;

  return {
    contract: MARKETING_SPAN_CONTRACT,
    spanId: input.spanId ?? createMarketingSpanId(),
    traceId: input.traceId,
    parentSpanId: input.parentSpanId ?? null,
    name: input.name,
    kind: input.kind,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    stage: input.stage,
    startedAt,
    endedAt,
    durationMs: endedAt ? computeDurationMs(startedAt, endedAt) : null,
    status,
    otelStatusCode: otelStatusFromSpanStatus(status),
    attempt: input.attempt ?? 1,
    attributes,
    error,
  };
}

export function appendSpan(trace: MarketingTrace, span: MarketingSpan): MarketingTrace {
  const spans = [...(trace.spans ?? []), span];
  return {
    ...trace,
    rootSpanId: trace.rootSpanId ?? (span.parentSpanId ? trace.rootSpanId : span.spanId),
    spans,
  };
}

export function finishSpan(
  span: MarketingSpan,
  input: {
    status: MarketingSpanStatus;
    endedAt?: string;
    attributes?: MarketingSpanAttributes;
    error?: MarketingSpanError | null;
  },
): MarketingSpan {
  const endedAt = input.endedAt ?? new Date().toISOString();
  const mergedAttrs = sanitizeSpanAttributes({
    ...span.attributes,
    ...(input.attributes ?? {}),
  }).attributes;
  const error = input.error
    ? { ...input.error, message: sanitizeSpanErrorMessage(input.error.message) }
    : input.error === null
      ? null
      : span.error;

  return {
    ...span,
    endedAt,
    durationMs: computeDurationMs(span.startedAt, endedAt),
    status: input.status,
    otelStatusCode: otelStatusFromSpanStatus(input.status),
    attributes: mergedAttrs,
    error,
  };
}

export function finishTrace(
  trace: MarketingTrace,
  input: { status: MarketingTraceStatus; endedAt?: string },
): MarketingTrace {
  return {
    ...trace,
    status: input.status,
    endedAt: input.endedAt ?? new Date().toISOString(),
  };
}
