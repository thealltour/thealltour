import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";

/** Opaque credentialRef → secret material. Never log the resolved value. */
export interface CredentialResolver {
  resolve(credentialRef: string): Promise<string>;
}

export interface ProviderExecutionContext {
  credentialResolver: CredentialResolver;
  signal?: AbortSignal;
  /** Per-request HTTP timeout. Defaults are adapter-specific / shared HTTP helper. */
  timeoutMs?: number;
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetch?: typeof fetch;
}

export interface ProviderAdapter {
  readonly providerId: string;
  generate(
    request: RuntimeRequest,
    model: ModelDefinition,
    context: ProviderExecutionContext,
  ): Promise<RuntimeResponse>;
}

/**
 * Optional normalized rate-limit hints for a future Quota Broker.
 * All fields optional — providers differ in header naming.
 */
export interface ProviderRateLimitMetadata {
  limitRequests?: number;
  remainingRequests?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetRequestsAt?: string;
  resetTokensAt?: string;
  retryAfterMs?: number;
  raw?: Record<string, string>;
}

export const DEFAULT_ADAPTER_TIMEOUT_MS = 60_000;
