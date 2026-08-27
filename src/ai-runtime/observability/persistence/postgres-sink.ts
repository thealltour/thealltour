import { buildSafeMetadata } from "@/ai-runtime/observability/persistence/metadata";
import type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";
import type {
  ObservabilityDbClient,
  RuntimeObservabilityEvent,
} from "@/ai-runtime/observability/persistence/types";

export const AI_RUNTIME_OBSERVABILITY_TABLE = "ai_runtime_observability_events";

export type PostgresRuntimeObservabilitySinkOptions = {
  client: ObservabilityDbClient;
  onError?: (message: string) => void;
};

function toRow(event: RuntimeObservabilityEvent): Record<string, unknown> {
  const metadata = buildSafeMetadata(event.metadata);
  return {
    event_type: event.eventType,
    request_id: event.requestId ?? null,
    correlation_id: event.correlationId ?? null,
    job_id: event.jobId ?? null,
    agent_id: event.agentId ?? null,
    source: event.source ?? null,
    workload: event.workload ?? null,
    priority: event.priority ?? null,
    provider_id: event.providerId ?? null,
    model_id: event.modelId ?? null,
    status: event.status ?? null,
    error_code: event.errorCode ?? null,
    retryable: event.retryable ?? null,
    fallback_used: event.fallbackUsed ?? null,
    attempt_count: event.attemptCount ?? null,
    input_tokens: event.inputTokens ?? null,
    output_tokens: event.outputTokens ?? null,
    total_tokens: event.totalTokens ?? null,
    usage_missing: event.usageMissing ?? null,
    reserved_input_tokens: event.reservedInputTokens ?? null,
    reserved_output_tokens: event.reservedOutputTokens ?? null,
    reserved_total_tokens: event.reservedTotalTokens ?? null,
    latency_ms: event.latencyMs ?? null,
    metadata_json: metadata,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
  };
}

/**
 * Append-only Postgres/Supabase sink. Never throws — inference must not fail on telemetry.
 */
export class PostgresRuntimeObservabilitySink implements RuntimeObservabilitySink {
  private readonly client: ObservabilityDbClient;
  private readonly onError?: (message: string) => void;

  constructor(options: PostgresRuntimeObservabilitySinkOptions) {
    this.client = options.client;
    this.onError = options.onError;
  }

  async record(event: RuntimeObservabilityEvent): Promise<void> {
    try {
      const result = await this.client.from(AI_RUNTIME_OBSERVABILITY_TABLE).insert(toRow(event));
      if (result.error) {
        this.onError?.(result.error.message ?? "observability insert failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onError?.(message);
    }
  }

  async recordMany(events: RuntimeObservabilityEvent[]): Promise<void> {
    if (events.length === 0) return;
    try {
      const result = await this.client
        .from(AI_RUNTIME_OBSERVABILITY_TABLE)
        .insert(events.map(toRow));
      if (result.error) {
        this.onError?.(result.error.message ?? "observability batch insert failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onError?.(message);
    }
  }
}

export function createPostgresRuntimeObservabilitySink(
  options: PostgresRuntimeObservabilitySinkOptions,
): PostgresRuntimeObservabilitySink {
  return new PostgresRuntimeObservabilitySink(options);
}
