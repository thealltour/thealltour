import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { RuntimeError, type RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { RuntimeRouteAttempt, RuntimeRouteAttemptResult } from "@/ai-runtime/domain/response";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import type { QuotaBroker } from "@/ai-runtime/quota/broker-types";
import { executeAndRecord } from "@/ai-runtime/quota/execute-and-record";
import type { UsageLedger } from "@/ai-runtime/quota/usage-ledger";
import type { TokenEstimator } from "@/ai-runtime/tokens/types";
import { checkContextFit, checkOutputLimit } from "@/ai-runtime/tokens/heuristic-estimator";

export type CandidateAttemptResult =
  | { kind: "success"; response: Awaited<ReturnType<typeof executeAndRecord>> }
  | { kind: "quota_rejected"; result: RuntimeRouteAttemptResult; detail: string; retryAfterMs?: number }
  | { kind: "context_rejected"; result: RuntimeRouteAttemptResult; detail: string }
  | { kind: "invalid_rejected"; result: RuntimeRouteAttemptResult; detail: string }
  | { kind: "provider_error"; error: RuntimeError; attempt: RuntimeRouteAttempt };

function reservationRequestId(requestId: string, modelId: string): string {
  return `${requestId}::route::${modelId}`;
}

export function mapRuntimeErrorToAttemptResult(code: RuntimeErrorCode): RuntimeRouteAttemptResult {
  switch (code) {
    case "RATE_LIMIT":
      return "rate_limited";
    case "QUOTA_EXHAUSTED":
      return "quota_exhausted";
    case "TIMEOUT":
      return "timeout";
    default:
      return "provider_error";
  }
}

export function isFallbackableProviderError(code: RuntimeErrorCode): boolean {
  return (
    code === "RATE_LIMIT" ||
    code === "QUOTA_EXHAUSTED" ||
    code === "TIMEOUT" ||
    code === "MODEL_UNAVAILABLE" ||
    code === "PROVIDER_ERROR"
  );
}

export function shouldSkipProviderOnError(code: RuntimeErrorCode): boolean {
  return code === "AUTH_ERROR";
}

export async function attemptCandidateExecution(input: {
  request: RuntimeRequest;
  model: ModelDefinition;
  adapter: ProviderAdapter;
  context: ProviderExecutionContext;
  estimator: TokenEstimator;
  quotaBroker: QuotaBroker;
  ledger: UsageLedger;
  correlationId?: string;
  startedAt: string;
}): Promise<CandidateAttemptResult> {
  const estimate = input.estimator.estimate(input.request, input.model);
  const contextFit = checkContextFit(estimate, input.model);
  if (!contextFit.fitsContext) {
    return {
      kind: "context_rejected",
      result: "rejected",
      detail: "context_exceeded",
    };
  }

  const outputLimit = checkOutputLimit(estimate, input.model);
  if (outputLimit.outputExceedsModelLimit) {
    return {
      kind: "invalid_rejected",
      result: "rejected",
      detail: "output_limit_exceeded",
    };
  }

  const reservationResult = await input.quotaBroker.reserve(
    {
      requestId: reservationRequestId(input.request.id, input.model.id),
      providerId: input.model.providerId,
      modelId: input.model.id,
      estimatedInputTokens: estimate.estimatedInputTokens,
      estimatedOutputTokens: estimate.estimatedOutputTokens,
    },
    { correlationId: input.correlationId },
  );

  if (!reservationResult.accepted) {
    return {
      kind: "quota_rejected",
      result: "quota_exhausted",
      detail: `reservation_rejected:${reservationResult.reason}`,
      retryAfterMs: reservationResult.retryAfterMs,
    };
  }

  const reservationId = reservationResult.reservationId;

  try {
    const response = await executeAndRecord(input.adapter, input.request, input.model, input.context, {
      ledger: input.ledger,
      correlationId: input.correlationId,
      startedAt: input.startedAt,
    });

    await input.quotaBroker.reconcile(reservationId, {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      usageMissing: response.rawMetadata?.usageMissing === true,
    });

    return { kind: "success", response };
  } catch (error) {
    await input.quotaBroker.release(reservationId, "provider_error");
    if (error instanceof RuntimeError) {
      return {
        kind: "provider_error",
        error,
        attempt: {
          providerId: input.model.providerId,
          modelId: input.model.id,
          startedAt: input.startedAt,
          result: mapRuntimeErrorToAttemptResult(error.code),
          detail: error.code,
        },
      };
    }
    throw error;
  }
}
