export type {
  MarketingAgentActorId,
  MarketingAttributeValue,
  MarketingDeterministicActorId,
  MarketingOtelStatusCode,
  MarketingSpan,
  MarketingSpanActorType,
  MarketingSpanAttributes,
  MarketingSpanError,
  MarketingSpanEvent,
  MarketingSpanKind,
  MarketingSpanStage,
  MarketingSpanStatus,
  MarketingTrace,
  MarketingTraceCorrelation,
  MarketingTraceStatus,
  MarketingTraceType,
} from "@/lib/marketing/observability/types";
export {
  MARKETING_SPAN_CONTRACT,
  MARKETING_TRACE_CONTRACT,
} from "@/lib/marketing/observability/types";

export {
  MARKETING_ATTR,
  attributesFromTokenUsage,
  pickMarketingAttributes,
  type MarketingAttrKey,
} from "@/lib/marketing/observability/attributes";

export {
  mapIncidentClassToTraceError,
  inferTraceErrorFromPipelineFailure,
  type MarketingTraceErrorClass,
} from "@/lib/marketing/observability/errors";

export {
  MARKETING_TRACE_PRIVACY_POLICY,
  FORBIDDEN_ATTRIBUTE_KEY_PATTERNS,
  MAX_ATTRIBUTE_STRING_LENGTH,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_ATTRIBUTES_JSON_BYTES,
  isForbiddenAttributeKey,
  sanitizeAttributeString,
  sanitizeSpanAttributes,
  sanitizeAttributesForPersistence,
  sanitizeSpanErrorMessage,
  truncateSummary,
} from "@/lib/marketing/observability/privacy";

export {
  createMarketingTraceId,
  createMarketingSpanId,
  isValidTraceId,
  isValidSpanId,
} from "@/lib/marketing/observability/ids";

export {
  validateMarketingTrace,
  validateSpanTimestamps,
  otelStatusFromSpanStatus,
  computeDurationMs,
  type TraceValidationIssue,
} from "@/lib/marketing/observability/validate";

export {
  toOtelCompatibleSpan,
  toOtelCompatibleTraceExport,
  assertAgentPrismMappingFeasible,
  mapSpanKindToOtel,
  mapOtelStatusCode,
  OTEL_SPAN_KIND,
  type OtelCompatibleSpanExport,
  type OtelCompatibleAttribute,
} from "@/lib/marketing/observability/otelMapping";

export {
  createMarketingTrace,
  createMarketingSpan,
  appendSpan,
  finishSpan,
  finishTrace,
} from "@/lib/marketing/observability/builders";

export type {
  MarketingTraceRecorder,
  StartTraceInput,
  StartSpanInput,
  EndSpanInput,
  EndTraceInput,
  FailSpanInput,
} from "@/lib/marketing/observability/recorder";

export {
  createNoopMarketingTraceRecorder,
  createInMemoryMarketingTraceRecorder,
  safeRecorder,
  type InMemoryMarketingTraceRecorder,
} from "@/lib/marketing/observability/recorderImpl";

export {
  withMarketingSpan,
  closeOpenSpansAsError,
  type MarketingTraceActiveContext,
} from "@/lib/marketing/observability/withSpan";

export {
  attributesForRequirements,
  attributesForEvidencePack,
  attributesForCompleteness,
  attributesForGovernance,
  attributesForHumanBoundary,
  humanBoundaryHandoffStatus,
} from "@/lib/marketing/observability/stageAttributes";

export {
  MARKETING_OBS_TRACES_TABLE,
  MARKETING_OBS_SPANS_TABLE,
  MARKETING_OBS_SCHEMA_VERSION,
  isTerminalSpanStatus,
  isTerminalTraceStatus,
  createInMemoryMarketingTraceStore,
  createSupabaseMarketingTraceStore,
  createMarketingTraceReadRepository,
  createPersistentMarketingTraceRecorder,
  MARKETING_TRACE_ENABLED_ENV,
  isMarketingTraceEnabled,
  resolveMarketingTraceRecorder,
  resolveMarketingTraceRecorderAsync,
  createTestDurableMarketingTraceStack,
  type MarketingTraceRow,
  type MarketingSpanRow,
  type MarketingTraceStore,
  type MarketingObsDbClient,
  type MarketingTraceReadRepository,
  type PersistentMarketingTraceRecorder,
} from "@/lib/marketing/observability/persistence";
