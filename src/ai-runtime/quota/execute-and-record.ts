import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import {
  usageEventFromError,
  usageEventFromResponse,
  type ErrorUsageEventInput,
  type UsageEventMetadata,
} from "@/ai-runtime/quota/record";
import type { UsageLedger } from "@/ai-runtime/quota/usage-ledger";

export type ExecuteAndRecordOptions = UsageEventMetadata & {
  ledger: UsageLedger;
  startedAt?: string;
};

/**
 * Explicit adapter wrapper — records usage without coupling telemetry into adapters.
 * Caller/orchestrator or future Quota Broker should use this at the lifecycle boundary.
 */
export async function executeAndRecord(
  adapter: ProviderAdapter,
  request: RuntimeRequest,
  model: ModelDefinition,
  context: ProviderExecutionContext,
  options: ExecuteAndRecordOptions,
): Promise<RuntimeResponse> {
  const startedAt = options.startedAt ?? new Date().toISOString();
  try {
    const response = await adapter.generate(request, model, context);
    options.ledger.record(
      usageEventFromResponse(response, {
        correlationId: options.correlationId,
        startedAt,
      }),
    );
    return response;
  } catch (error) {
    if (error instanceof RuntimeError) {
      const failureInput: ErrorUsageEventInput = {
        requestId: request.id,
        providerId: adapter.providerId,
        modelId: model.id,
        correlationId: options.correlationId,
        startedAt,
        completedAt: new Date().toISOString(),
      };
      options.ledger.record(usageEventFromError(error, failureInput));
    }
    throw error;
  }
}

export function recordRuntimeResponse(
  ledger: UsageLedger,
  response: RuntimeResponse,
  metadata?: UsageEventMetadata,
): void {
  ledger.record(usageEventFromResponse(response, metadata));
}

export function recordRuntimeError(
  ledger: UsageLedger,
  error: RuntimeError,
  input: ErrorUsageEventInput,
): void {
  ledger.record(usageEventFromError(error, input));
}
