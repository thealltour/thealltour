import type {
  MarketingSpan,
  MarketingTrace,
} from "@/lib/marketing/observability/types";
import {
  createMarketingSpan,
  createMarketingTrace,
  finishSpan,
  finishTrace,
} from "@/lib/marketing/observability/builders";
import { sanitizeSpanAttributes } from "@/lib/marketing/observability/privacy";
import { otelStatusFromSpanStatus } from "@/lib/marketing/observability/validate";
import type {
  EndSpanInput,
  EndTraceInput,
  FailSpanInput,
  MarketingTraceRecorder,
  StartSpanInput,
  StartTraceInput,
} from "@/lib/marketing/observability/recorder";

export function createNoopMarketingTraceRecorder(): MarketingTraceRecorder {
  return {
    startTrace(input) {
      const trace = createMarketingTrace({
        traceType: input.traceType,
        correlation: input.correlation,
        startedAt: input.startedAt,
      });
      return { traceId: trace.traceId, trace };
    },
    endTrace() {},
    startSpan(input) {
      const span = createMarketingSpan({
        traceId: input.traceId,
        name: input.name,
        kind: input.kind,
        stage: input.stage,
        actorType: input.actorType,
        actorId: input.actorId,
        parentSpanId: input.parentSpanId,
        attempt: input.attempt,
        startedAt: input.startedAt,
        attributes: input.attributes,
      });
      return { spanId: span.spanId, span };
    },
    endSpan() {},
    failSpan() {},
    addSpanAttributes() {},
  };
}

export type InMemoryMarketingTraceRecorder = MarketingTraceRecorder & {
  getTrace(traceId: string): MarketingTrace | undefined;
  getSpans(traceId: string): MarketingSpan[];
  snapshot(): MarketingTrace[];
  clear(): void;
};

export function createInMemoryMarketingTraceRecorder(): InMemoryMarketingTraceRecorder {
  const traces = new Map<string, MarketingTrace>();
  const spans = new Map<string, Map<string, MarketingSpan>>();

  function spanMap(traceId: string): Map<string, MarketingSpan> {
    let map = spans.get(traceId);
    if (!map) {
      map = new Map();
      spans.set(traceId, map);
    }
    return map;
  }

  function syncTraceSpans(traceId: string): void {
    const trace = traces.get(traceId);
    if (!trace) return;
    const list = [...(spanMap(traceId).values())];
    traces.set(traceId, { ...trace, spans: list, rootSpanId: trace.rootSpanId ?? list[0]?.spanId ?? null });
  }

  const recorder: InMemoryMarketingTraceRecorder = {
    startTrace(input: StartTraceInput) {
      const trace = createMarketingTrace({
        traceType: input.traceType,
        correlation: input.correlation,
        startedAt: input.startedAt,
      });
      traces.set(trace.traceId, { ...trace, spans: [] });
      spans.set(trace.traceId, new Map());
      return { traceId: trace.traceId, trace };
    },

    endTrace(input: EndTraceInput) {
      const existing = traces.get(input.traceId);
      if (!existing) return;
      let next = finishTrace(existing, { status: input.status, endedAt: input.endedAt });
      if (input.correlation) {
        next = {
          ...next,
          productionRequestId: input.correlation.productionRequestId ?? next.productionRequestId,
          logicalRunKey: input.correlation.logicalRunKey ?? next.logicalRunKey,
          agendaSlateId: input.correlation.agendaSlateId ?? next.agendaSlateId,
          agendaCandidateId: input.correlation.agendaCandidateId ?? next.agendaCandidateId,
          assignmentId: input.correlation.assignmentId ?? next.assignmentId,
          candidateId: input.correlation.candidateId ?? next.candidateId,
          reviewId: input.correlation.reviewId ?? next.reviewId,
          runId: input.correlation.runId ?? next.runId,
          correlationId: input.correlation.correlationId ?? next.correlationId,
          researchBriefId: input.correlation.researchBriefId ?? next.researchBriefId,
          governanceReviewId: input.correlation.governanceReviewId ?? next.governanceReviewId,
        };
      }
      traces.set(input.traceId, next);
      syncTraceSpans(input.traceId);
    },

    startSpan(input: StartSpanInput) {
      const span = createMarketingSpan({
        traceId: input.traceId,
        name: input.name,
        kind: input.kind,
        stage: input.stage,
        actorType: input.actorType,
        actorId: input.actorId,
        parentSpanId: input.parentSpanId,
        attempt: input.attempt,
        startedAt: input.startedAt,
        attributes: input.attributes,
      });
      const map = spanMap(input.traceId);
      map.set(span.spanId, span);
      const trace = traces.get(input.traceId);
      if (trace && !trace.rootSpanId && !span.parentSpanId) {
        traces.set(input.traceId, { ...trace, rootSpanId: span.spanId });
      }
      syncTraceSpans(input.traceId);
      return { spanId: span.spanId, span };
    },

    endSpan(input: EndSpanInput) {
      const map = spanMap(input.traceId);
      const existing = map.get(input.spanId);
      if (!existing) return;
      const finished = finishSpan(existing, {
        status: input.status,
        endedAt: input.endedAt,
        attributes: input.attributes,
        error: input.error,
      });
      map.set(
        input.spanId,
        {
          ...finished,
          otelStatusCode: input.otelStatusCode ?? finished.otelStatusCode ?? otelStatusFromSpanStatus(input.status),
        },
      );
      syncTraceSpans(input.traceId);
    },

    failSpan(input: FailSpanInput) {
      recorder.endSpan({
        traceId: input.traceId,
        spanId: input.spanId,
        status: "error",
        endedAt: input.endedAt,
        attributes: input.attributes,
        error: input.error,
        otelStatusCode: "ERROR",
      });
    },

    addSpanAttributes(input) {
      const map = spanMap(input.traceId);
      const existing = map.get(input.spanId);
      if (!existing) return;
      const { attributes } = sanitizeSpanAttributes({
        ...existing.attributes,
        ...input.attributes,
      });
      map.set(input.spanId, { ...existing, attributes });
      syncTraceSpans(input.traceId);
    },

    getTrace(traceId) {
      syncTraceSpans(traceId);
      return traces.get(traceId);
    },

    getSpans(traceId) {
      return [...(spanMap(traceId).values())];
    },

    snapshot() {
      for (const id of traces.keys()) syncTraceSpans(id);
      return [...traces.values()];
    },

    clear() {
      traces.clear();
      spans.clear();
    },
  };

  return recorder;
}

/** Wrap a recorder so any throw is swallowed — production must not fail on telemetry. */
export function safeRecorder(inner: MarketingTraceRecorder): MarketingTraceRecorder {
  const guard = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  return {
    startTrace(input) {
      return guard(
        () => inner.startTrace(input),
        {
          traceId: "00000000000000000000000000000001",
          trace: createMarketingTrace({
            traceType: input.traceType,
            correlation: input.correlation,
            startedAt: input.startedAt,
            traceId: "00000000000000000000000000000001",
          }),
        },
      );
    },
    endTrace(input) {
      guard(() => {
        inner.endTrace(input);
        return undefined;
      }, undefined);
    },
    startSpan(input) {
      return guard(
        () => inner.startSpan(input),
        {
          spanId: "0000000000000001",
          span: createMarketingSpan({
            ...input,
            spanId: "0000000000000001",
          }),
        },
      );
    },
    endSpan(input) {
      guard(() => {
        inner.endSpan(input);
        return undefined;
      }, undefined);
    },
    failSpan(input) {
      guard(() => {
        inner.failSpan(input);
        return undefined;
      }, undefined);
    },
    addSpanAttributes(input) {
      guard(() => {
        inner.addSpanAttributes(input);
        return undefined;
      }, undefined);
    },
  };
}
