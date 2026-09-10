import {
  MARKETING_SPAN_CONTRACT,
  MARKETING_TRACE_CONTRACT,
  type MarketingSpan,
  type MarketingTrace,
} from "@/lib/marketing/observability/types";

export type MarketingTraceListItemDto = {
  traceId: string;
  traceType: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  productionRequestId: string | null;
  logicalRunKey: string | null;
  assignmentId: string | null;
  candidateId: string | null;
  reviewId: string | null;
  spanCount: number;
};

export type MarketingSpanDto = {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  kind: string;
  actorType: string;
  actorId: string | null;
  stage: string;
  attempt: number;
  status: string;
  otelStatusCode: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  attributes: Record<string, string | number | boolean | readonly string[]>;
  error: {
    class: string;
    message: string;
    pipelineFailureCode?: string | null;
  } | null;
};

export type MarketingTraceDetailDto = {
  trace: MarketingTraceListItemDto & {
    agendaSlateId: string | null;
    agendaCandidateId: string | null;
    rootSpanId: string | null;
  };
  spans: MarketingSpanDto[];
};

function durationMs(startedAt: string, endedAt: string | null | undefined): number | null {
  if (!endedAt) return null;
  const a = Date.parse(startedAt);
  const b = Date.parse(endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a);
}

export function toTraceListItemDto(trace: MarketingTrace): MarketingTraceListItemDto {
  return {
    traceId: trace.traceId,
    traceType: trace.traceType,
    status: trace.status,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt ?? null,
    durationMs: durationMs(trace.startedAt, trace.endedAt),
    productionRequestId: trace.productionRequestId ?? null,
    logicalRunKey: trace.logicalRunKey ?? null,
    assignmentId: trace.assignmentId ?? null,
    candidateId: trace.candidateId ?? null,
    reviewId: trace.reviewId ?? null,
    spanCount: trace.spans?.length ?? 0,
  };
}

export function toSpanDto(span: MarketingSpan): MarketingSpanDto {
  return {
    spanId: span.spanId,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId ?? null,
    name: span.name,
    kind: span.kind,
    actorType: span.actorType,
    actorId: span.actorId ?? null,
    stage: span.stage,
    attempt: span.attempt,
    status: span.status,
    otelStatusCode: span.otelStatusCode ?? null,
    startedAt: span.startedAt,
    endedAt: span.endedAt ?? null,
    durationMs: span.durationMs ?? durationMs(span.startedAt, span.endedAt),
    attributes: { ...(span.attributes ?? {}) } as MarketingSpanDto["attributes"],
    error: span.error
      ? {
          class: span.error.class,
          message: span.error.message,
          pipelineFailureCode: span.error.pipelineFailureCode ?? null,
        }
      : null,
  };
}

export function toTraceDetailDto(trace: MarketingTrace, spans: MarketingSpan[]): MarketingTraceDetailDto {
  const list = toTraceListItemDto({ ...trace, spans });
  return {
    trace: {
      ...list,
      spanCount: spans.length,
      agendaSlateId: trace.agendaSlateId ?? null,
      agendaCandidateId: trace.agendaCandidateId ?? null,
      rootSpanId: trace.rootSpanId ?? null,
    },
    spans: spans.map(toSpanDto),
  };
}

export function dtoToMarketingTrace(
  detail: MarketingTraceDetailDto,
): { trace: MarketingTrace; spans: MarketingSpan[] } {
  const spans: MarketingSpan[] = detail.spans.map((s) => ({
    contract: MARKETING_SPAN_CONTRACT,
    spanId: s.spanId,
    traceId: s.traceId,
    parentSpanId: s.parentSpanId,
    name: s.name,
    kind: s.kind as MarketingSpan["kind"],
    actorType: s.actorType as MarketingSpan["actorType"],
    actorId: s.actorId,
    stage: s.stage as MarketingSpan["stage"],
    attempt: s.attempt,
    status: s.status as MarketingSpan["status"],
    otelStatusCode: (s.otelStatusCode as MarketingSpan["otelStatusCode"]) ?? undefined,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMs: s.durationMs,
    attributes: s.attributes,
    error: s.error
      ? {
          class: s.error.class as NonNullable<MarketingSpan["error"]>["class"],
          message: s.error.message,
          pipelineFailureCode: s.error.pipelineFailureCode,
        }
      : null,
  }));

  const trace: MarketingTrace = {
    contract: MARKETING_TRACE_CONTRACT,
    traceId: detail.trace.traceId,
    traceType: detail.trace.traceType as MarketingTrace["traceType"],
    status: detail.trace.status as MarketingTrace["status"],
    startedAt: detail.trace.startedAt,
    endedAt: detail.trace.endedAt,
    rootSpanId: detail.trace.rootSpanId,
    productionRequestId: detail.trace.productionRequestId,
    logicalRunKey: detail.trace.logicalRunKey,
    agendaSlateId: detail.trace.agendaSlateId,
    agendaCandidateId: detail.trace.agendaCandidateId,
    assignmentId: detail.trace.assignmentId,
    candidateId: detail.trace.candidateId,
    reviewId: detail.trace.reviewId,
    spans,
  };

  return { trace, spans };
}
