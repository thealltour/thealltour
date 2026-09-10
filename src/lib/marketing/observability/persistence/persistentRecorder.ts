import {
  createMarketingSpan,
  createMarketingTrace,
  finishSpan,
  finishTrace,
} from "@/lib/marketing/observability/builders";
import { sanitizeAttributesForPersistence, sanitizeSpanErrorMessage } from "@/lib/marketing/observability/privacy";
import { otelStatusFromSpanStatus } from "@/lib/marketing/observability/validate";
import type {
  EndSpanInput,
  EndTraceInput,
  FailSpanInput,
  MarketingTraceRecorder,
  StartSpanInput,
  StartTraceInput,
} from "@/lib/marketing/observability/recorder";
import type { MarketingTraceStore } from "@/lib/marketing/observability/persistence/store";
import { spanToRow, traceToRow } from "@/lib/marketing/observability/persistence/types";
import type { MarketingSpan, MarketingTrace } from "@/lib/marketing/observability/types";

export type PersistentMarketingTraceRecorder = MarketingTraceRecorder & {
  /** Wait for fire-and-forget store writes (tests / shutdown). */
  flush(): Promise<void>;
};

export type CreatePersistentMarketingTraceRecorderOptions = {
  store: MarketingTraceStore;
  onError?: (message: string) => void;
  /**
   * When true, each write is awaited before returning (tests).
   * Production default false = fire-and-forget; use flush() to drain.
   */
  awaitWrites?: boolean;
};

/**
 * Durable MarketingTraceRecorder backed by MarketingTraceStore (in-memory or Supabase).
 * Sync API for OBS-2 compatibility; persistence is async and isolated.
 */
export function createPersistentMarketingTraceRecorder(
  options: CreatePersistentMarketingTraceRecorderOptions,
): PersistentMarketingTraceRecorder {
  const { store, onError } = options;
  const pending: Promise<void>[] = [];
  let writeChain: Promise<void> = Promise.resolve();
  const localTraces = new Map<string, MarketingTrace>();
  const localSpans = new Map<string, MarketingSpan>();

  /** Serialize writes so start/end ordering is preserved under fire-and-forget. */
  const track = (work: () => Promise<void>) => {
    writeChain = writeChain
      .then(work)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(sanitizeSpanErrorMessage(message));
      });
    pending.push(writeChain);
    return writeChain;
  };

  const recorder: PersistentMarketingTraceRecorder = {
    startTrace(input: StartTraceInput) {
      const { attributes } = sanitizeAttributesForPersistence(input.attributes ?? {});
      const trace = createMarketingTrace({
        traceType: input.traceType,
        correlation: input.correlation,
        startedAt: input.startedAt,
      });
      localTraces.set(trace.traceId, trace);
      track(async () => {
        await store.upsertTrace(traceToRow(trace, attributes));
      });
      return { traceId: trace.traceId, trace };
    },

    endTrace(input: EndTraceInput) {
      const existing = localTraces.get(input.traceId);
      let next = existing
        ? finishTrace(existing, { status: input.status, endedAt: input.endedAt })
        : null;
      if (next && input.correlation) {
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
      if (next) localTraces.set(input.traceId, next);
      track(async () => {
        if (next) {
          const existingRow = await store.getTraceRow(input.traceId);
          const { attributes } = sanitizeAttributesForPersistence({
            ...(existingRow?.attributes ?? {}),
            ...(input.attributes ?? {}),
          });
          await store.upsertTrace(traceToRow(next, attributes));
          return;
        }
        const { attributes } = sanitizeAttributesForPersistence(input.attributes ?? {});
        await store.updateTrace(input.traceId, {
          status: input.status,
          ended_at: input.endedAt ?? new Date().toISOString(),
          attributes,
          ...(input.correlation
            ? {
                production_request_id: input.correlation.productionRequestId ?? null,
                logical_run_key: input.correlation.logicalRunKey ?? null,
                agenda_slate_id: input.correlation.agendaSlateId ?? null,
                agenda_candidate_id: input.correlation.agendaCandidateId ?? null,
                assignment_id: input.correlation.assignmentId ?? null,
                completed_candidate_id: input.correlation.candidateId ?? null,
                hmr_id: input.correlation.reviewId ?? null,
                run_id: input.correlation.runId ?? null,
                correlation_id: input.correlation.correlationId ?? null,
                research_brief_id: input.correlation.researchBriefId ?? null,
                governance_review_id: input.correlation.governanceReviewId ?? null,
              }
            : {}),
        });
      });
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
      const { attributes } = sanitizeAttributesForPersistence(span.attributes);
      const sanitized = { ...span, attributes };
      localSpans.set(`${span.traceId}:${span.spanId}`, sanitized);
      const trace = localTraces.get(input.traceId);
      if (trace && !trace.rootSpanId && !span.parentSpanId) {
        localTraces.set(input.traceId, { ...trace, rootSpanId: span.spanId });
        track(async () => {
          await store.updateTrace(input.traceId, { root_span_id: span.spanId });
        });
      }
      track(async () => {
        await store.upsertSpan(spanToRow(sanitized));
      });
      return { spanId: span.spanId, span: sanitized };
    },

    endSpan(input: EndSpanInput) {
      const key = `${input.traceId}:${input.spanId}`;
      const existing = localSpans.get(key);
      const finished = existing
        ? finishSpan(existing, {
            status: input.status,
            endedAt: input.endedAt,
            attributes: input.attributes,
            error: input.error,
          })
        : null;
      const withOtel = finished
        ? {
            ...finished,
            otelStatusCode:
              input.otelStatusCode ?? finished.otelStatusCode ?? otelStatusFromSpanStatus(input.status),
          }
        : null;
      if (withOtel) {
        const { attributes } = sanitizeAttributesForPersistence(withOtel.attributes);
        const sanitized = { ...withOtel, attributes };
        localSpans.set(key, sanitized);
        track(async () => {
          await store.upsertSpan(spanToRow(sanitized));
        });
        return;
      }
      const { attributes } = sanitizeAttributesForPersistence(input.attributes ?? {});
      track(async () => {
        await store.updateSpan(input.traceId, input.spanId, {
          business_status: input.status,
          otel_status_code: input.otelStatusCode ?? otelStatusFromSpanStatus(input.status),
          ended_at: input.endedAt ?? new Date().toISOString(),
          attributes,
          error_class: input.error?.class ?? null,
          error_code: input.error?.pipelineFailureCode ?? null,
          error_message: input.error ? sanitizeSpanErrorMessage(input.error.message) : null,
        });
      });
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
      const key = `${input.traceId}:${input.spanId}`;
      const existing = localSpans.get(key);
      const { attributes } = sanitizeAttributesForPersistence({
        ...(existing?.attributes ?? {}),
        ...input.attributes,
      });
      if (existing) {
        localSpans.set(key, { ...existing, attributes });
      }
      track(async () => {
        await store.updateSpan(input.traceId, input.spanId, { attributes });
      });
    },

    async flush() {
      await Promise.allSettled([...pending]);
      pending.length = 0;
    },
  };

  return recorder;
}
