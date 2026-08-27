import type { WorkloadClass } from "@/ai-runtime/domain/workload";

export const RUNTIME_OBSERVABILITY_EVENT_TYPES = [
  "job_enqueued",
  "job_started",
  "job_deferred",
  "job_completed",
  "job_failed",
  "job_cancelled",
  "route_completed",
  "route_failed",
  "provider_success",
  "provider_error",
  "reservation_created",
  "reservation_reconciled",
  "reservation_released",
  "reservation_expired",
] as const;

export type RuntimeObservabilityEventType = (typeof RUNTIME_OBSERVABILITY_EVENT_TYPES)[number];

/** Allow-listed safe metadata keys only — never prompts/messages/headers/secrets. */
export const SAFE_OBSERVABILITY_METADATA_KEYS = [
  "cronJobId",
  "departmentId",
  "deferReason",
  "quotaReason",
  "actualBackendModel",
  "availableAt",
  "remainingRequests",
  "remainingTokens",
  "retryAfterMs",
] as const;

export type SafeObservabilityMetadataKey = (typeof SAFE_OBSERVABILITY_METADATA_KEYS)[number];

export type SafeObservabilityMetadata = Partial<
  Record<SafeObservabilityMetadataKey, string | number | boolean>
>;

export type RuntimeObservabilityEvent = {
  eventType: RuntimeObservabilityEventType;
  occurredAt?: string;

  requestId?: string;
  correlationId?: string;
  jobId?: string;

  agentId?: string;
  source?: string;
  workload?: WorkloadClass | string;
  priority?: string;

  providerId?: string;
  modelId?: string;

  status?: string;
  errorCode?: string;
  retryable?: boolean;

  fallbackUsed?: boolean;
  attemptCount?: number;

  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageMissing?: boolean;

  reservedInputTokens?: number;
  reservedOutputTokens?: number;
  reservedTotalTokens?: number;

  latencyMs?: number;

  metadata?: SafeObservabilityMetadata;
};

export type SharedLastHourSummaryDto = {
  requests: number;
  completed: number;
  failed: number;
  fallbacks: number;
  providerCalls: number;
};

export type SharedProviderUsageDto = {
  providerId: string;
  displayName: string;
  requests: number;
  tokens?: number;
  tokensKnown: boolean;
  errors: number;
  usageMissingCount: number;
};

export type SharedRecentJobDto = {
  occurredAt: string;
  jobId?: string;
  requestId?: string;
  correlationId?: string;
  correlationShort?: string;
  cronJobId?: string;
  agentId?: string;
  source?: string;
  workload?: string;
  priority?: string;
  status?: string;
  attempts?: number;
  providerId?: string;
  modelId?: string;
  fallbackUsed?: boolean;
  errorCode?: string;
  latencyMs?: number;
  totalTokens?: number;
  usageMissing?: boolean;
};

export type SharedRecentRouteDto = {
  occurredAt: string;
  requestId?: string;
  correlationId?: string;
  workload?: string;
  priority?: string;
  selectedProviderId?: string;
  selectedModelId?: string;
  attemptCount?: number;
  fallbackUsed?: boolean;
  finalStatus?: string;
  errorCode?: string;
};

export type SharedRuntimeTelemetryDto = {
  available: boolean;
  lastHour: SharedLastHourSummaryDto;
  providerUsage: SharedProviderUsageDto[];
  recentJobs: SharedRecentJobDto[];
  recentRoutes: SharedRecentRouteDto[];
};

/** Injectable Supabase-like client for inserts/selects (tests + server). */
export type ObservabilityDbClient = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => PromiseLike<{
      error: { message?: string } | null;
    }>;
    select: (columns?: string) => {
      gte: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => {
          limit: (count: number) => PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};
