import type { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { ProviderRateLimitMetadata } from "@/ai-runtime/adapters/types";
import type { RuntimeUsageEvent, UsageEventResult } from "@/ai-runtime/quota/types";

export type UsageEventMetadata = {
  correlationId?: string;
  startedAt?: string;
  completedAt?: string;
};

export type ErrorUsageEventInput = UsageEventMetadata & {
  requestId: string;
  providerId: string;
  /** Registry internal model id. */
  modelId: string;
  rateLimit?: ProviderRateLimitMetadata;
};

function readRateLimit(rawMetadata: Record<string, unknown> | undefined): ProviderRateLimitMetadata | undefined {
  const value = rawMetadata?.rateLimit;
  if (!value || typeof value !== "object") return undefined;
  return value as ProviderRateLimitMetadata;
}

function readUsageMissing(rawMetadata: Record<string, unknown> | undefined): boolean {
  return rawMetadata?.usageMissing === true;
}

export function normalizeRuntimeErrorResult(code: RuntimeError["code"]): UsageEventResult {
  switch (code) {
    case "RATE_LIMIT":
      return "rate_limited";
    case "QUOTA_EXHAUSTED":
      return "quota_exhausted";
    case "TIMEOUT":
      return "timeout";
    case "AUTH_ERROR":
      return "auth_error";
    case "MODEL_UNAVAILABLE":
      return "model_unavailable";
    case "INVALID_REQUEST":
    case "CONTEXT_TOO_LARGE":
      return "invalid_request";
    case "PROVIDER_ERROR":
    case "RUNTIME_ERROR":
    default:
      return "provider_error";
  }
}

function buildEventId(requestId: string, completedAt: string, result: UsageEventResult): string {
  return `${requestId}:${completedAt}:${result}`;
}

export function usageEventFromResponse(
  response: RuntimeResponse,
  metadata: UsageEventMetadata = {},
): RuntimeUsageEvent {
  const usageMissing = readUsageMissing(response.rawMetadata);
  const rateLimit = readRateLimit(response.rawMetadata);
  const startedAt =
    metadata.startedAt ??
    response.routing.attempts[0]?.startedAt ??
    metadata.completedAt ??
    new Date(Date.now() - response.latencyMs).toISOString();
  const completedAt = metadata.completedAt ?? new Date(Date.parse(startedAt) + response.latencyMs).toISOString();

  return {
    id: buildEventId(response.requestId, completedAt, "success"),
    requestId: response.requestId,
    correlationId: metadata.correlationId,
    providerId: response.providerId,
    modelId: response.modelId,
    startedAt,
    completedAt,
    result: "success",
    inputTokens: usageMissing ? undefined : response.usage.inputTokens,
    outputTokens: usageMissing ? undefined : response.usage.outputTokens,
    totalTokens: usageMissing ? undefined : response.usage.totalTokens,
    cachedInputTokens: usageMissing ? undefined : response.usage.cachedInputTokens,
    usageMissing,
    latencyMs: response.latencyMs,
    retryAfterMs: rateLimit?.retryAfterMs,
    rateLimit,
  };
}

export function usageEventFromError(
  error: RuntimeError,
  input: ErrorUsageEventInput,
): RuntimeUsageEvent {
  const result = normalizeRuntimeErrorResult(error.code);
  const completedAt = input.completedAt ?? new Date().toISOString();
  const startedAt = input.startedAt ?? completedAt;
  const rateLimit = input.rateLimit;

  return {
    id: buildEventId(input.requestId, completedAt, result),
    requestId: input.requestId,
    correlationId: input.correlationId,
    providerId: input.providerId,
    modelId: input.modelId,
    startedAt,
    completedAt,
    result,
    usageMissing: true,
    retryAfterMs: error.retryAfterMs ?? rateLimit?.retryAfterMs,
    rateLimit,
  };
}
