import type { QuotaCapacity, QuotaHealth } from "@/ai-runtime/domain/quota";
import type { ProviderRateLimitMetadata } from "@/ai-runtime/adapters/types";

export const USAGE_EVENT_RESULTS = [
  "success",
  "rate_limited",
  "quota_exhausted",
  "timeout",
  "provider_error",
  "auth_error",
  "invalid_request",
  "model_unavailable",
] as const;

export type UsageEventResult = (typeof USAGE_EVENT_RESULTS)[number];

export interface RuntimeUsageEvent {
  id: string;
  requestId: string;
  correlationId?: string;
  providerId: string;
  /** Registry internal model id (not provider slug). */
  modelId: string;
  startedAt: string;
  completedAt: string;
  result: UsageEventResult;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  usageMissing?: boolean;
  latencyMs?: number;
  retryAfterMs?: number;
  rateLimit?: ProviderRateLimitMetadata;
}

export interface UsageWindowAggregation {
  requestCount: number;
  successCount: number;
  errorCount: number;
  rateLimitedCount: number;
  quotaExhaustedCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  knownTokenEventCount: number;
  usageMissingCount: number;
}

export interface ObservedQuotaSnapshot {
  limitRequests?: number;
  remainingRequests?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetRequestsAt?: string;
  resetTokensAt?: string;
  retryAfterMs?: number;
  observedAt: string;
}

export interface RuntimeQuotaState {
  providerId: string;
  modelId?: string;
  health: QuotaHealth;
  minute: {
    requests: number;
    tokens?: number;
    tokensKnown: boolean;
  };
  day: {
    requests: number;
    tokens?: number;
    tokensKnown: boolean;
  };
  configured?: QuotaCapacity;
  observed?: ObservedQuotaSnapshot;
  retryAfterMs?: number;
  blockedUntil?: string;
  lastUpdatedAt?: string;
}

export interface CorrelationUsageSummary {
  correlationId: string;
  llmCallCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  knownTokenEventCount: number;
  usageMissingCount: number;
  providerIds: string[];
  modelIds: string[];
}

export interface UsageLedgerSnapshot {
  eventCount: number;
  oldestEventAt?: string;
  newestEventAt?: string;
}
