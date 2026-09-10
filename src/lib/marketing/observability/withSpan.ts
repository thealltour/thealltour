import type { MarketingSpanAttributes, MarketingSpanError } from "@/lib/marketing/observability/types";
import type { EndSpanInput, MarketingTraceRecorder, StartSpanInput } from "@/lib/marketing/observability/recorder";
import { inferTraceErrorFromPipelineFailure } from "@/lib/marketing/observability/errors";
import { sanitizeSpanErrorMessage } from "@/lib/marketing/observability/privacy";

export type MarketingTraceActiveContext = {
  recorder: MarketingTraceRecorder;
  traceId: string;
  rootSpanId: string;
};

/**
 * Run work inside a span. Never lets recorder failures escape.
 * Business exceptions rethrow after failSpan/endSpan.
 */
export async function withMarketingSpan<T>(
  recorder: MarketingTraceRecorder,
  start: StartSpanInput,
  work: (spanId: string) => Promise<T>,
  onSuccess?: (result: T) => Omit<EndSpanInput, "traceId" | "spanId"> | void,
): Promise<T> {
  let spanId = "";
  try {
    spanId = recorder.startSpan(start).spanId;
  } catch {
    spanId = "";
  }

  try {
    const result = await work(spanId);
    if (spanId) {
      try {
        const end = onSuccess?.(result);
        recorder.endSpan({
          traceId: start.traceId,
          spanId,
          status: end?.status ?? "ok",
          attributes: end?.attributes,
          error: end?.error,
          otelStatusCode: end?.otelStatusCode,
          endedAt: end?.endedAt,
        });
      } catch {
        /* ignore recorder */
      }
    }
    return result;
  } catch (error) {
    if (spanId) {
      try {
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : "span_failed";
        const spanError: MarketingSpanError = {
          class: inferTraceErrorFromPipelineFailure({ message }),
          message: sanitizeSpanErrorMessage(message),
        };
        recorder.failSpan({
          traceId: start.traceId,
          spanId,
          error: spanError,
          attributes: {
            "marketing.result.summary": "technical_failure",
          } satisfies MarketingSpanAttributes,
        });
      } catch {
        /* ignore recorder */
      }
    }
    throw error;
  }
}

export function closeOpenSpansAsError(
  recorder: MarketingTraceRecorder,
  spans: Array<{ traceId: string; spanId: string; message: string }>,
): void {
  for (const item of spans) {
    try {
      recorder.failSpan({
        traceId: item.traceId,
        spanId: item.spanId,
        error: {
          class: inferTraceErrorFromPipelineFailure({ message: item.message }),
          message: sanitizeSpanErrorMessage(item.message),
        },
      });
    } catch {
      /* ignore */
    }
  }
}
