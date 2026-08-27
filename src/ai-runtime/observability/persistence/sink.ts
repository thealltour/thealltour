import type { RuntimeObservabilityEvent } from "@/ai-runtime/observability/persistence/types";

/**
 * Best-effort shared telemetry writer.
 * Implementations must never throw to inference callers.
 */
export interface RuntimeObservabilitySink {
  record(event: RuntimeObservabilityEvent): Promise<void>;
  recordMany?(events: RuntimeObservabilityEvent[]): Promise<void>;
}
