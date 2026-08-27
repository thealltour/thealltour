import type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";
import type { RuntimeObservabilityEvent } from "@/ai-runtime/observability/persistence/types";

/**
 * In-process event buffer for tests and cross-process simulation
 * (shared array reference acts as “DB”).
 */
export class InMemoryRuntimeObservabilitySink implements RuntimeObservabilitySink {
  readonly events: RuntimeObservabilityEvent[];

  constructor(store: RuntimeObservabilityEvent[] = []) {
    this.events = store;
  }

  async record(event: RuntimeObservabilityEvent): Promise<void> {
    this.events.push({
      ...event,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    });
  }

  async recordMany(events: RuntimeObservabilityEvent[]): Promise<void> {
    for (const event of events) {
      await this.record(event);
    }
  }

  clear(): void {
    this.events.length = 0;
  }
}

export function createInMemoryRuntimeObservabilitySink(
  store?: RuntimeObservabilityEvent[],
): InMemoryRuntimeObservabilitySink {
  return new InMemoryRuntimeObservabilitySink(store);
}
