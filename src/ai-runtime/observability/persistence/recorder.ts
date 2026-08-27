import { buildSafeMetadata } from "@/ai-runtime/observability/persistence/metadata";
import type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";
import type {
  RuntimeObservabilityEvent,
  SafeObservabilityMetadata,
} from "@/ai-runtime/observability/persistence/types";

export type RuntimeObservabilityRecorder = {
  record(event: RuntimeObservabilityEvent): void;
  jobEnqueued(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  jobStarted(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  jobDeferred(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  jobCompleted(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  jobFailed(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  jobCancelled(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  routeCompleted(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  routeFailed(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  providerSuccess(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  providerError(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  reservationCreated(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  reservationReconciled(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  reservationReleased(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
  reservationExpired(event: Omit<RuntimeObservabilityEvent, "eventType">): void;
};

function normalize(event: RuntimeObservabilityEvent): RuntimeObservabilityEvent {
  return {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    metadata: buildSafeMetadata(event.metadata as SafeObservabilityMetadata | undefined),
  };
}

/**
 * Fire-and-forget recorder. Sink failures never reject callers.
 */
export function createRuntimeObservabilityRecorder(
  sink: RuntimeObservabilitySink,
): RuntimeObservabilityRecorder {
  const emit = (event: RuntimeObservabilityEvent): void => {
    void sink.record(normalize(event)).catch(() => {
      // best-effort — never surface to inference
    });
  };

  const typed =
    (eventType: RuntimeObservabilityEvent["eventType"]) =>
    (event: Omit<RuntimeObservabilityEvent, "eventType">): void => {
      emit({ ...event, eventType });
    };

  return {
    record: emit,
    jobEnqueued: typed("job_enqueued"),
    jobStarted: typed("job_started"),
    jobDeferred: typed("job_deferred"),
    jobCompleted: typed("job_completed"),
    jobFailed: typed("job_failed"),
    jobCancelled: typed("job_cancelled"),
    routeCompleted: typed("route_completed"),
    routeFailed: typed("route_failed"),
    providerSuccess: typed("provider_success"),
    providerError: typed("provider_error"),
    reservationCreated: typed("reservation_created"),
    reservationReconciled: typed("reservation_reconciled"),
    reservationReleased: typed("reservation_released"),
    reservationExpired: typed("reservation_expired"),
  };
}
