import type {
  MarketingAttributeValue,
  MarketingSpan,
  MarketingSpanActorType,
  MarketingSpanAttributes,
  MarketingSpanError,
  MarketingSpanKind,
  MarketingSpanStage,
  MarketingSpanStatus,
  MarketingTrace,
  MarketingTraceCorrelation,
  MarketingTraceStatus,
  MarketingTraceType,
  MarketingOtelStatusCode,
} from "@/lib/marketing/observability/types";

export type StartTraceInput = {
  traceType: MarketingTraceType;
  correlation?: MarketingTraceCorrelation;
  startedAt?: string;
  attributes?: MarketingSpanAttributes;
};

export type StartSpanInput = {
  traceId: string;
  name: string;
  kind: MarketingSpanKind;
  stage: MarketingSpanStage;
  actorType: MarketingSpanActorType;
  actorId?: string | null;
  parentSpanId?: string | null;
  attempt?: number;
  startedAt?: string;
  attributes?: MarketingSpanAttributes;
};

export type EndSpanInput = {
  traceId: string;
  spanId: string;
  status: MarketingSpanStatus;
  endedAt?: string;
  attributes?: MarketingSpanAttributes;
  error?: MarketingSpanError | null;
  /** Override OTel code when business status alone is ambiguous. */
  otelStatusCode?: MarketingOtelStatusCode;
};

export type FailSpanInput = {
  traceId: string;
  spanId: string;
  error: MarketingSpanError;
  endedAt?: string;
  attributes?: MarketingSpanAttributes;
};

export type EndTraceInput = {
  traceId: string;
  status: MarketingTraceStatus;
  endedAt?: string;
  attributes?: MarketingSpanAttributes;
  /** Soft correlation attach (candidate/HMR may arrive after startTrace). */
  correlation?: MarketingTraceCorrelation;
};

/**
 * Thin recorder — production code must not know about DB / AgentPrism / OTLP.
 * Implementations must never throw into callers (use {@link safeRecorder}).
 */
export type MarketingTraceRecorder = {
  startTrace(input: StartTraceInput): { traceId: string; trace: MarketingTrace };
  endTrace(input: EndTraceInput): void;
  startSpan(input: StartSpanInput): { spanId: string; span: MarketingSpan };
  endSpan(input: EndSpanInput): void;
  failSpan(input: FailSpanInput): void;
  addSpanAttributes(input: {
    traceId: string;
    spanId: string;
    attributes: Record<string, MarketingAttributeValue>;
  }): void;
};
