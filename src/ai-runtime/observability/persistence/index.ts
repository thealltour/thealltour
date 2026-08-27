export type {
  RuntimeObservabilityEvent,
  RuntimeObservabilityEventType,
  SafeObservabilityMetadata,
  SharedRuntimeTelemetryDto,
  SharedLastHourSummaryDto,
  SharedProviderUsageDto,
  SharedRecentJobDto,
  SharedRecentRouteDto,
  ObservabilityDbClient,
} from "@/ai-runtime/observability/persistence/types";

export {
  RUNTIME_OBSERVABILITY_EVENT_TYPES,
  SAFE_OBSERVABILITY_METADATA_KEYS,
} from "@/ai-runtime/observability/persistence/types";

export { buildSafeMetadata } from "@/ai-runtime/observability/persistence/metadata";
export type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";
export {
  NoopRuntimeObservabilitySink,
  createNoopRuntimeObservabilitySink,
} from "@/ai-runtime/observability/persistence/noop-sink";
export {
  InMemoryRuntimeObservabilitySink,
  createInMemoryRuntimeObservabilitySink,
} from "@/ai-runtime/observability/persistence/memory-sink";
export {
  PostgresRuntimeObservabilitySink,
  createPostgresRuntimeObservabilitySink,
  AI_RUNTIME_OBSERVABILITY_TABLE,
} from "@/ai-runtime/observability/persistence/postgres-sink";
export {
  createRuntimeObservabilityRecorder,
  type RuntimeObservabilityRecorder,
} from "@/ai-runtime/observability/persistence/recorder";
export {
  AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED_ENV,
  isAiRuntimeSharedObservabilityEnabled,
  createRuntimeObservabilitySink,
  resolveRuntimeObservabilitySink,
  createDefaultRuntimeObservabilityRecorder,
  getDefaultRuntimeObservabilityRecorder,
  setDefaultRuntimeObservabilityRecorder,
  resetDefaultRuntimeObservabilityRecorderForTests,
  ensureSharedObservabilityRecorder,
} from "@/ai-runtime/observability/persistence/factory";
export {
  createMemoryRuntimeObservabilityRepository,
  createPostgresRuntimeObservabilityRepository,
  resolveRuntimeObservabilityRepository,
  aggregateLastHourSummary,
  aggregateProviderUsage,
  aggregateRecentJobs,
  aggregateRecentRoutes,
  type RuntimeObservabilityRepository,
} from "@/ai-runtime/observability/persistence/repository";
export { createObservabilitySupabaseClientFromEnv } from "@/ai-runtime/observability/persistence/supabase-client";
