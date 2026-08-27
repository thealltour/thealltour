import type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";

/** Default when shared persistence is disabled or DB unavailable. */
export class NoopRuntimeObservabilitySink implements RuntimeObservabilitySink {
  async record(): Promise<void> {
    // intentionally empty
  }

  async recordMany(): Promise<void> {
    // intentionally empty
  }
}

export function createNoopRuntimeObservabilitySink(): RuntimeObservabilitySink {
  return new NoopRuntimeObservabilitySink();
}
