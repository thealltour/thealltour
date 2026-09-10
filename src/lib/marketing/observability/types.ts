/**
 * OBS-1 — Marketing observability trace/span contracts (OTel-compatible).
 *
 * Domain-owned types. Do not import AgentPrism or OTel SDK types here.
 * Correlate with existing DailyMarketingRunObservability, MarketingOperationsTrace,
 * and AI Runtime RuntimeObservabilityEvent via attribute/correlation keys — do not
 * duplicate those frameworks.
 */

export const MARKETING_TRACE_CONTRACT = "marketing-trace-v1" as const;
export const MARKETING_SPAN_CONTRACT = "marketing-span-v1" as const;

/** High-level production or supporting workflow represented by one trace. */
export type MarketingTraceType =
  | "marketing_production"
  /** @deprecated Prefer marketing_production — kept for OBS-1 fixtures. */
  | "production"
  | "agenda_slate"
  | "research"
  | "performance"
  | "orchestration"
  | "human_review";

/**
 * Trace lifecycle status (workflow envelope).
 * Not the same as OTel span status or CompletedMarketingCandidate.status.
 */
export type MarketingTraceStatus = "running" | "completed" | "failed" | "partial";

/**
 * Span kinds — maps loosely to OTel SpanKind + domain roles.
 * AgentPrism/OTel exporters should map these; do not force SDK enums in core.
 */
export type MarketingSpanKind =
  | "agent"
  | "tool"
  | "deterministic"
  | "validation"
  | "orchestration"
  | "human_boundary"
  | "internal";

/**
 * Business / pipeline outcome for a span.
 * Kept separate from {@link MarketingOtelStatusCode}.
 */
export type MarketingSpanStatus =
  | "running"
  | "ok"
  | "error"
  | "skipped"
  | "revision_required"
  | "blocked";

/** OTel StatusCode analogue for export — never merge into MarketingSpanStatus. */
export type MarketingOtelStatusCode = "UNSET" | "OK" | "ERROR";

export type MarketingSpanActorType =
  | "hermes_bot"
  | "typescript_staff"
  | "human"
  | "system"
  | "ai_runtime";

/**
 * Stable stage labels along the production spine (and extensible peers).
 * Prefer these over free-form stage strings in attributes.
 */
export type MarketingSpanStage =
  | "production_request"
  | "marketing_manager"
  | "deliverable_requirements"
  | "evidence_pack"
  | "content_strategist"
  | "completeness_validator"
  | "governance_auditor"
  | "performance_analyst"
  | "candidate_persist"
  | "human_review"
  | "research"
  | "agenda_slate"
  | "media_brief"
  | "semantic_dedupe"
  | "other";

/** Well-known agent actor ids (Hermes profile / registry). */
export type MarketingAgentActorId =
  | "marketing-manager"
  | "content-strategist"
  | "governance-auditor"
  | "performance-analyst";

/** Well-known deterministic staff ids (not Hermes bots). */
export type MarketingDeterministicActorId =
  | "deliverable_requirements"
  | "evidence_pack"
  | "completeness_validator"
  | "semantic_dedupe"
  | "media_brief";

/**
 * Attribute values — OTel-compatible primitives (+ string arrays).
 * Never put secrets, raw prompts, or unrestricted model text here.
 */
export type MarketingAttributeValue = string | number | boolean | readonly string[];

export type MarketingSpanAttributes = Record<string, MarketingAttributeValue>;

/**
 * Span error payload — prefer {@link MarketingTraceErrorClass} + sanitized message.
 * `incidentClass` links to existing MarketingIncidentClass when available.
 */
export type MarketingSpanError = {
  /** OBS-1 taxonomy (see errors.ts). */
  class: import("@/lib/marketing/observability/errors").MarketingTraceErrorClass;
  /** Existing MarketingIncidentClass when mapped from pipeline/incident layer. */
  incidentClass?: string | null;
  /** Sanitized, bounded message — never secrets/tokens. */
  message: string;
  retryable?: boolean;
  /** Pipeline failure code when known (e.g. content_unavailable). */
  pipelineFailureCode?: string | null;
};

export type MarketingSpanEvent = {
  name: string;
  time: string;
  attributes?: MarketingSpanAttributes;
};

export type MarketingSpan = {
  contract: typeof MARKETING_SPAN_CONTRACT;
  spanId: string;
  traceId: string;
  parentSpanId?: string | null;
  name: string;
  kind: MarketingSpanKind;
  actorType: MarketingSpanActorType;
  /** Hermes profile id, staff id, or runtime agent id. */
  actorId?: string | null;
  stage: MarketingSpanStage;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  /** Business / pipeline outcome. */
  status: MarketingSpanStatus;
  /** OTel export status — independent of {@link status}. */
  otelStatusCode?: MarketingOtelStatusCode;
  /** 1-based attempt within this span identity (revision / retry). */
  attempt: number;
  attributes: MarketingSpanAttributes;
  error?: MarketingSpanError | null;
  events?: MarketingSpanEvent[];
};

/**
 * Root correlation envelope for one marketing workflow execution.
 * DB FKs are intentionally absent in OBS-1 — ids are soft correlation only.
 */
export type MarketingTrace = {
  contract: typeof MARKETING_TRACE_CONTRACT;
  traceId: string;
  traceType: MarketingTraceType;
  startedAt: string;
  endedAt?: string | null;
  status: MarketingTraceStatus;
  rootSpanId?: string | null;
  /** Soft correlation — align with MarketingOperationsTrace / run observability. */
  productionRequestId?: string | null;
  logicalRunKey?: string | null;
  runId?: string | null;
  correlationId?: string | null;
  agendaSlateId?: string | null;
  candidateId?: string | null;
  assignmentId?: string | null;
  researchBriefId?: string | null;
  agendaCandidateId?: string | null;
  reviewId?: string | null;
  governanceReviewId?: string | null;
  businessDateKst?: string | null;
  /** Optional in-memory span list for builders/tests; persistence is out of OBS-1. */
  spans?: MarketingSpan[];
};

/**
 * Flattened correlation bag for linking domain entities without FKs.
 * Compatible with MarketingOperationsTrace field names where they overlap.
 */
export type MarketingTraceCorrelation = {
  productionRequestId?: string | null;
  logicalRunKey?: string | null;
  runId?: string | null;
  correlationId?: string | null;
  agendaSlateId?: string | null;
  candidateId?: string | null;
  assignmentId?: string | null;
  researchBriefId?: string | null;
  agendaCandidateId?: string | null;
  reviewId?: string | null;
  governanceReviewId?: string | null;
  /** AI Runtime job / request ids when an agent span used the runtime. */
  aiRuntimeRequestId?: string | null;
  aiRuntimeJobId?: string | null;
  aiRuntimeCorrelationId?: string | null;
};
