import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type {
  RuntimeFinishReason,
  RuntimeResponse,
  RuntimeRouteAttemptResult,
} from "@/ai-runtime/domain/response";
import type { TokenUsage } from "@/ai-runtime/domain/usage";
import { RuntimeError } from "@/ai-runtime/domain/error";
import type { ProviderRateLimitMetadata } from "@/ai-runtime/adapters/types";
import {
  DEFAULT_ADAPTER_TIMEOUT_MS,
  type ProviderAdapter,
  type ProviderExecutionContext,
} from "@/ai-runtime/adapters/types";
import {
  extractRateLimitMetadata,
  isAbortError,
  mapHttpStatusToRuntimeError,
} from "@/ai-runtime/adapters/http";
import { safeErrorMessage } from "@/ai-runtime/adapters/redaction";

export function assertAdapterOwnsModel(
  adapter: Pick<ProviderAdapter, "providerId">,
  model: ModelDefinition,
): void {
  if (model.providerId !== adapter.providerId) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      `Adapter ${adapter.providerId} cannot execute model "${model.id}" owned by ${model.providerId}`,
      false,
    );
  }
  if (!model.modelId?.trim()) {
    throw new RuntimeError("INVALID_REQUEST", "ModelDefinition.modelId is required", false);
  }
}

export function assertHasMessages(request: RuntimeRequest): void {
  if (!request.messages?.length) {
    throw new RuntimeError("INVALID_REQUEST", "RuntimeRequest.messages must not be empty", false);
  }
}

export function resolveTimeoutMs(context: ProviderExecutionContext): number {
  return context.timeoutMs && context.timeoutMs > 0 ? context.timeoutMs : DEFAULT_ADAPTER_TIMEOUT_MS;
}

export function mergeAbortSignals(
  timeoutMs: number,
  outer?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", onOuterAbort);
    },
  };
}

export function usageFromPartial(input: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  provided: boolean;
}): { usage: TokenUsage; usageMissing: boolean } {
  if (!input.provided) {
    return {
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      usageMissing: true,
    };
  }
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const totalTokens = input.totalTokens ?? inputTokens + outputTokens;
  return {
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
      cachedInputTokens: input.cachedInputTokens,
    },
    usageMissing: false,
  };
}

export function buildSuccessResponse(input: {
  request: RuntimeRequest;
  providerId: string;
  /** Registry model id (internal) for routing bookkeeping. */
  registryModelId: string;
  /** Provider slug actually requested. */
  providerModelSlug: string;
  content: string;
  usage: TokenUsage;
  usageMissing: boolean;
  latencyMs: number;
  finishReason?: RuntimeFinishReason;
  startedAt: string;
  rateLimit?: ProviderRateLimitMetadata;
  rawMetadata?: Record<string, unknown>;
}): RuntimeResponse {
  const attemptResult: RuntimeRouteAttemptResult = "success";
  return {
    requestId: input.request.id,
    providerId: input.providerId,
    modelId: input.registryModelId,
    content: input.content,
    usage: input.usage,
    cost: undefined,
    latencyMs: input.latencyMs,
    finishReason: input.finishReason,
    routing: {
      attempts: [
        {
          providerId: input.providerId,
          modelId: input.registryModelId,
          startedAt: input.startedAt,
          result: attemptResult,
        },
      ],
      fallbackUsed: false,
    },
    rawMetadata: {
      providerModelSlug: input.providerModelSlug,
      usageMissing: input.usageMissing,
      ...(input.rateLimit ? { rateLimit: input.rateLimit } : {}),
      ...input.rawMetadata,
    },
  };
}

export async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function providerFetchJson(input: {
  url: string;
  init: RequestInit;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  outerSignal?: AbortSignal;
  secrets: string[];
}): Promise<{ response: Response; rateLimit: ProviderRateLimitMetadata; bodyText: string }> {
  const { signal, cleanup } = mergeAbortSignals(input.timeoutMs, input.outerSignal);
  try {
    const response = await input.fetchImpl(input.url, { ...input.init, signal, cache: "no-store" });
    const rateLimit = extractRateLimitMetadata(response.headers);
    if (!response.ok) {
      const bodyText = await readErrorBody(response);
      throw mapHttpStatusToRuntimeError({
        status: response.status,
        bodyText,
        rateLimit,
        secrets: input.secrets,
      });
    }
    const bodyText = await response.text();
    return { response, rateLimit, bodyText };
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    if (isAbortError(error)) {
      throw new RuntimeError(
        "TIMEOUT",
        `Provider request timed out after ${input.timeoutMs}ms`,
        true,
      );
    }
    const message = safeErrorMessage(
      error instanceof Error ? error.message : "Provider request failed",
      input.secrets,
    );
    throw new RuntimeError("PROVIDER_ERROR", message, true, undefined, {
      name: error instanceof Error ? error.name : "Error",
    });
  } finally {
    cleanup();
  }
}

export function parseJsonBody(bodyText: string, secrets: string[]): unknown {
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new RuntimeError(
      "PROVIDER_ERROR",
      safeErrorMessage("Provider returned non-JSON body", secrets),
      true,
    );
  }
}

export async function resolveApiKey(
  context: ProviderExecutionContext,
  credentialRef: string | undefined,
  providerId: string,
): Promise<string> {
  if (!credentialRef?.trim()) {
    throw new RuntimeError(
      "AUTH_ERROR",
      `Provider ${providerId} has no credentialRef configured`,
      false,
    );
  }
  return context.credentialResolver.resolve(credentialRef);
}
