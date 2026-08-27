import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import type { QuotaReservationRequest } from "@/ai-runtime/domain/quota";
import type { QuotaBroker } from "@/ai-runtime/quota/broker-types";
import { executeAndRecord } from "@/ai-runtime/quota/execute-and-record";
import type { UsageLedger } from "@/ai-runtime/quota/usage-ledger";
import type { TokenEstimator } from "@/ai-runtime/tokens/types";
import { checkContextFit, checkOutputLimit } from "@/ai-runtime/tokens/heuristic-estimator";

export type ExecuteWithReservationOptions = {
  request: RuntimeRequest;
  model: ModelDefinition;
  adapter: ProviderAdapter;
  context: ProviderExecutionContext;
  estimator: TokenEstimator;
  quotaBroker: QuotaBroker;
  ledger: UsageLedger;
  correlationId?: string;
};

function reservationRequestFromEstimate(
  request: RuntimeRequest,
  model: ModelDefinition,
  estimate: ReturnType<TokenEstimator["estimate"]>,
): QuotaReservationRequest {
  return {
    requestId: request.id,
    providerId: model.providerId,
    modelId: model.id,
    estimatedInputTokens: estimate.estimatedInputTokens,
    estimatedOutputTokens: estimate.estimatedOutputTokens,
  };
}

function quotaRejectionError(
  reason: string,
  retryAfterMs?: number,
): RuntimeError {
  return new RuntimeError(
    "QUOTA_EXHAUSTED",
    `Quota reservation rejected (${reason})`,
    true,
    retryAfterMs,
  );
}

/**
 * Orchestrates estimate → reserve → execute → reconcile/release.
 * Does not perform provider fallback — Router owns that in STEP 2-5.3.
 */
export async function executeWithReservation(
  options: ExecuteWithReservationOptions,
): Promise<RuntimeResponse> {
  const { request, model, adapter, context, estimator, quotaBroker, ledger } = options;
  const correlationId = options.correlationId ?? request.metadata?.correlationId;

  const estimate = estimator.estimate(request, model);
  const contextFit = checkContextFit(estimate, model);
  if (!contextFit.fitsContext) {
    throw new RuntimeError(
      "CONTEXT_TOO_LARGE",
      "Estimated tokens exceed model context window",
      false,
    );
  }

  const outputLimit = checkOutputLimit(estimate, model);
  if (outputLimit.outputExceedsModelLimit) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      "Estimated output tokens exceed model maxOutputTokens",
      false,
    );
  }

  const reservationRequest = reservationRequestFromEstimate(request, model, estimate);
  const reservationResult = await quotaBroker.reserve(reservationRequest, { correlationId });

  if (!reservationResult.accepted) {
    throw quotaRejectionError(reservationResult.reason, reservationResult.retryAfterMs);
  }

  const reservationId = reservationResult.reservationId;

  try {
    const response = await executeAndRecord(adapter, request, model, context, {
      ledger,
      correlationId,
    });

    await quotaBroker.reconcile(reservationId, {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      usageMissing: response.rawMetadata?.usageMissing === true,
    });

    return response;
  } catch (error) {
    await quotaBroker.release(reservationId, "provider_error");
    throw error;
  }
}
