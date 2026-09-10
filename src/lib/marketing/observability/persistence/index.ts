export type {
  MarketingTraceRow,
  MarketingSpanRow,
} from "@/lib/marketing/observability/persistence/types";
export {
  MARKETING_OBS_TRACES_TABLE,
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_SCHEMA_VERSION,
  isTerminalSpanStatus,
  isTerminalTraceStatus,
  traceToRow,
  spanToRow,
  rowToTrace,
  rowToSpan,
} from "@/lib/marketing/observability/persistence/types";

export type {
  MarketingTraceStore,
  MarketingObsDbClient,
  TraceCorrelationPatch,
} from "@/lib/marketing/observability/persistence/store";

export { createInMemoryMarketingTraceStore } from "@/lib/marketing/observability/persistence/inMemoryStore";
export { createSupabaseMarketingTraceStore } from "@/lib/marketing/observability/persistence/supabaseStore";
export {
  createMarketingTraceReadRepository,
  type MarketingTraceReadRepository,
} from "@/lib/marketing/observability/persistence/repository";
export {
  createPersistentMarketingTraceRecorder,
  type PersistentMarketingTraceRecorder,
  type CreatePersistentMarketingTraceRecorderOptions,
} from "@/lib/marketing/observability/persistence/persistentRecorder";
export {
  MARKETING_TRACE_ENABLED_ENV,
  isMarketingTraceEnabled,
  resolveMarketingTraceRecorder,
  resolveMarketingTraceRecorderAsync,
  createTestDurableMarketingTraceStack,
  type ResolveMarketingTraceRecorderOptions,
} from "@/lib/marketing/observability/persistence/factory";
