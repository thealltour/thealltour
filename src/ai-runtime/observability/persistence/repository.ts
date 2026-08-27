import { PROVIDER_DISPLAY_LABELS } from "@/ai-runtime/router/policies";
import type { RuntimeObservabilityEvent } from "@/ai-runtime/observability/persistence/types";
import type {
  ObservabilityDbClient,
  SharedLastHourSummaryDto,
  SharedProviderUsageDto,
  SharedRecentJobDto,
  SharedRecentRouteDto,
  SharedRuntimeTelemetryDto,
} from "@/ai-runtime/observability/persistence/types";
import { AI_RUNTIME_OBSERVABILITY_TABLE } from "@/ai-runtime/observability/persistence/postgres-sink";
import { buildSafeMetadata } from "@/ai-runtime/observability/persistence/metadata";

const DEFAULT_RECENT_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;

export type RuntimeObservabilityRepository = {
  lastHourSummary(now?: Date): Promise<SharedLastHourSummaryDto>;
  recentJobs(limit?: number, now?: Date): Promise<SharedRecentJobDto[]>;
  recentRoutes(limit?: number, now?: Date): Promise<SharedRecentRouteDto[]>;
  providerUsage(now?: Date): Promise<SharedProviderUsageDto[]>;
  loadSharedTelemetry(now?: Date): Promise<SharedRuntimeTelemetryDto>;
};

function shortenCorrelation(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.length <= 24) return id;
  return `${id.slice(0, 12)}…${id.slice(-6)}`;
}

function emptyTelemetry(available: boolean): SharedRuntimeTelemetryDto {
  return {
    available,
    lastHour: { requests: 0, completed: 0, failed: 0, fallbacks: 0, providerCalls: 0 },
    providerUsage: [],
    recentJobs: [],
    recentRoutes: [],
  };
}

function eventTime(event: RuntimeObservabilityEvent): number {
  return Date.parse(event.occurredAt ?? "") || 0;
}

function filterLastHour(events: RuntimeObservabilityEvent[], now: Date): RuntimeObservabilityEvent[] {
  const cutoff = now.getTime() - HOUR_MS;
  return events.filter((event) => eventTime(event) >= cutoff);
}

export function aggregateLastHourSummary(
  events: RuntimeObservabilityEvent[],
  now: Date = new Date(),
): SharedLastHourSummaryDto {
  const hour = filterLastHour(events, now);
  const jobTerminal = hour.filter(
    (e) => e.eventType === "job_completed" || e.eventType === "job_failed",
  );
  const completed = hour.filter((e) => e.eventType === "job_completed").length;
  const failed = hour.filter((e) => e.eventType === "job_failed").length;
  const fallbacks = hour.filter(
    (e) =>
      (e.eventType === "route_completed" || e.eventType === "route_failed") && e.fallbackUsed === true,
  ).length;
  const providerCalls = hour.filter(
    (e) => e.eventType === "provider_success" || e.eventType === "provider_error",
  ).length;

  // Prefer route events as "requests"; fall back to job terminal count.
  const routeEvents = hour.filter(
    (e) => e.eventType === "route_completed" || e.eventType === "route_failed",
  );
  const requests = routeEvents.length > 0 ? routeEvents.length : jobTerminal.length;

  return { requests, completed, failed, fallbacks, providerCalls };
}

export function aggregateProviderUsage(
  events: RuntimeObservabilityEvent[],
  now: Date = new Date(),
): SharedProviderUsageDto[] {
  const hour = filterLastHour(events, now).filter(
    (e) => e.eventType === "provider_success" || e.eventType === "provider_error",
  );

  const byProvider = new Map<
    string,
    { requests: number; tokens: number; tokensKnown: boolean; errors: number; usageMissingCount: number }
  >();

  for (const event of hour) {
    const providerId = event.providerId ?? "unknown";
    const row = byProvider.get(providerId) ?? {
      requests: 0,
      tokens: 0,
      tokensKnown: false,
      errors: 0,
      usageMissingCount: 0,
    };
    row.requests += 1;
    if (event.eventType === "provider_error") row.errors += 1;
    if (event.usageMissing === true) {
      row.usageMissingCount += 1;
    } else if (typeof event.totalTokens === "number" && Number.isFinite(event.totalTokens)) {
      row.tokens += event.totalTokens;
      row.tokensKnown = true;
    }
    byProvider.set(providerId, row);
  }

  return [...byProvider.entries()].map(([providerId, row]) => ({
    providerId,
    displayName: PROVIDER_DISPLAY_LABELS[providerId] ?? providerId,
    requests: row.requests,
    tokens: row.tokensKnown ? row.tokens : undefined,
    tokensKnown: row.tokensKnown,
    errors: row.errors,
    usageMissingCount: row.usageMissingCount,
  }));
}

function toRecentJob(event: RuntimeObservabilityEvent): SharedRecentJobDto {
  const metadata = buildSafeMetadata(event.metadata);
  return {
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    jobId: event.jobId,
    requestId: event.requestId,
    correlationId: event.correlationId,
    correlationShort: shortenCorrelation(event.correlationId),
    cronJobId: typeof metadata.cronJobId === "string" ? metadata.cronJobId : undefined,
    agentId: event.agentId,
    source: event.source,
    workload: event.workload,
    priority: event.priority,
    status: event.status ?? (event.eventType === "job_completed" ? "completed" : event.eventType === "job_failed" ? "failed" : undefined),
    attempts: event.attemptCount,
    providerId: event.providerId,
    modelId: event.modelId,
    fallbackUsed: event.fallbackUsed,
    errorCode: event.errorCode,
    latencyMs: event.latencyMs,
    totalTokens: event.usageMissing === true ? undefined : event.totalTokens,
    usageMissing: event.usageMissing,
  };
}

function toRecentRoute(event: RuntimeObservabilityEvent): SharedRecentRouteDto {
  return {
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    requestId: event.requestId,
    correlationId: event.correlationId,
    workload: event.workload,
    priority: event.priority,
    selectedProviderId: event.providerId,
    selectedModelId: event.modelId,
    attemptCount: event.attemptCount,
    fallbackUsed: event.fallbackUsed,
    finalStatus: event.status ?? (event.eventType === "route_completed" ? "success" : "failed"),
    errorCode: event.errorCode,
  };
}

export function aggregateRecentJobs(
  events: RuntimeObservabilityEvent[],
  limit = DEFAULT_RECENT_LIMIT,
): SharedRecentJobDto[] {
  return events
    .filter(
      (e) =>
        e.eventType === "job_completed" ||
        e.eventType === "job_failed" ||
        e.eventType === "job_deferred" ||
        e.eventType === "job_cancelled",
    )
    .sort((a, b) => eventTime(b) - eventTime(a))
    .slice(0, limit)
    .map(toRecentJob);
}

export function aggregateRecentRoutes(
  events: RuntimeObservabilityEvent[],
  limit = DEFAULT_RECENT_LIMIT,
): SharedRecentRouteDto[] {
  return events
    .filter((e) => e.eventType === "route_completed" || e.eventType === "route_failed")
    .sort((a, b) => eventTime(b) - eventTime(a))
    .slice(0, limit)
    .map(toRecentRoute);
}

/** Memory-backed repository for tests / cross-process simulation. */
export function createMemoryRuntimeObservabilityRepository(
  events: RuntimeObservabilityEvent[],
): RuntimeObservabilityRepository {
  return {
    async lastHourSummary(now = new Date()) {
      return aggregateLastHourSummary(events, now);
    },
    async recentJobs(limit = DEFAULT_RECENT_LIMIT) {
      return aggregateRecentJobs(events, limit);
    },
    async recentRoutes(limit = DEFAULT_RECENT_LIMIT) {
      return aggregateRecentRoutes(events, limit);
    },
    async providerUsage(now = new Date()) {
      return aggregateProviderUsage(events, now);
    },
    async loadSharedTelemetry(now = new Date()) {
      return {
        available: true,
        lastHour: aggregateLastHourSummary(events, now),
        providerUsage: aggregateProviderUsage(events, now),
        recentJobs: aggregateRecentJobs(events),
        recentRoutes: aggregateRecentRoutes(events),
      };
    },
  };
}

function rowToEvent(row: Record<string, unknown>): RuntimeObservabilityEvent {
  const metadata = buildSafeMetadata(
    (row.metadata_json as Record<string, unknown> | undefined) ?? undefined,
  );
  return {
    eventType: row.event_type as RuntimeObservabilityEvent["eventType"],
    occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : undefined,
    requestId: typeof row.request_id === "string" ? row.request_id : undefined,
    correlationId: typeof row.correlation_id === "string" ? row.correlation_id : undefined,
    jobId: typeof row.job_id === "string" ? row.job_id : undefined,
    agentId: typeof row.agent_id === "string" ? row.agent_id : undefined,
    source: typeof row.source === "string" ? row.source : undefined,
    workload: typeof row.workload === "string" ? row.workload : undefined,
    priority: typeof row.priority === "string" ? row.priority : undefined,
    providerId: typeof row.provider_id === "string" ? row.provider_id : undefined,
    modelId: typeof row.model_id === "string" ? row.model_id : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    errorCode: typeof row.error_code === "string" ? row.error_code : undefined,
    retryable: typeof row.retryable === "boolean" ? row.retryable : undefined,
    fallbackUsed: typeof row.fallback_used === "boolean" ? row.fallback_used : undefined,
    attemptCount: typeof row.attempt_count === "number" ? row.attempt_count : undefined,
    inputTokens: typeof row.input_tokens === "number" ? row.input_tokens : undefined,
    outputTokens: typeof row.output_tokens === "number" ? row.output_tokens : undefined,
    totalTokens: typeof row.total_tokens === "number" ? row.total_tokens : undefined,
    usageMissing: typeof row.usage_missing === "boolean" ? row.usage_missing : undefined,
    reservedInputTokens:
      typeof row.reserved_input_tokens === "number" ? row.reserved_input_tokens : undefined,
    reservedOutputTokens:
      typeof row.reserved_output_tokens === "number" ? row.reserved_output_tokens : undefined,
    reservedTotalTokens:
      typeof row.reserved_total_tokens === "number" ? row.reserved_total_tokens : undefined,
    latencyMs: typeof row.latency_ms === "number" ? row.latency_ms : undefined,
    metadata,
  };
}

export function createPostgresRuntimeObservabilityRepository(
  client: ObservabilityDbClient,
): RuntimeObservabilityRepository {
  async function loadHour(now: Date): Promise<RuntimeObservabilityEvent[]> {
    const since = new Date(now.getTime() - HOUR_MS).toISOString();
    try {
      const result = await client
        .from(AI_RUNTIME_OBSERVABILITY_TABLE)
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (result.error || !result.data) return [];
      return result.data.map(rowToEvent);
    } catch {
      return [];
    }
  }

  return {
    async lastHourSummary(now = new Date()) {
      return aggregateLastHourSummary(await loadHour(now), now);
    },
    async recentJobs(limit = DEFAULT_RECENT_LIMIT, now = new Date()) {
      return aggregateRecentJobs(await loadHour(now), limit);
    },
    async recentRoutes(limit = DEFAULT_RECENT_LIMIT, now = new Date()) {
      return aggregateRecentRoutes(await loadHour(now), limit);
    },
    async providerUsage(now = new Date()) {
      return aggregateProviderUsage(await loadHour(now), now);
    },
    async loadSharedTelemetry(now = new Date()) {
      const events = await loadHour(now);
      if (events.length === 0) {
        // available=true when client exists even if empty — caller distinguishes empty vs unavailable
        return {
          available: true,
          lastHour: aggregateLastHourSummary(events, now),
          providerUsage: aggregateProviderUsage(events, now),
          recentJobs: [],
          recentRoutes: [],
        };
      }
      return {
        available: true,
        lastHour: aggregateLastHourSummary(events, now),
        providerUsage: aggregateProviderUsage(events, now),
        recentJobs: aggregateRecentJobs(events),
        recentRoutes: aggregateRecentRoutes(events),
      };
    },
  };
}

export async function resolveRuntimeObservabilityRepository(
  options: {
    env?: Record<string, string | undefined>;
    client?: ObservabilityDbClient;
    events?: RuntimeObservabilityEvent[];
  } = {},
): Promise<RuntimeObservabilityRepository | null> {
  if (options.events) {
    return createMemoryRuntimeObservabilityRepository(options.events);
  }

  const { isAiRuntimeSharedObservabilityEnabled } = await import(
    "@/ai-runtime/observability/persistence/factory"
  );
  const env = options.env ?? process.env;
  if (!isAiRuntimeSharedObservabilityEnabled(env)) {
    return null;
  }

  if (options.client) {
    return createPostgresRuntimeObservabilityRepository(options.client);
  }

  const { createObservabilitySupabaseClientFromEnv } = await import(
    "@/ai-runtime/observability/persistence/supabase-client"
  );
  const fromEnv = createObservabilitySupabaseClientFromEnv(env);
  if (fromEnv) {
    return createPostgresRuntimeObservabilityRepository(fromEnv);
  }

  try {
    const mod = await import("@/lib/supabaseAdmin");
    return createPostgresRuntimeObservabilityRepository(
      mod.supabaseAdmin as unknown as ObservabilityDbClient,
    );
  } catch {
    return null;
  }
}

export { emptyTelemetry };
