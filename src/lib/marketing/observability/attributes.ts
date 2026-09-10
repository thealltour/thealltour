/**
 * Attribute naming convention for Marketing spans.
 * Prefer these constants over ad-hoc strings. Values stay OTel-compatible primitives.
 *
 * gen_ai.* mirrors OpenTelemetry GenAI semantic conventions and links to
 * AI Runtime TokenUsage / RuntimeObservabilityEvent fields — do not invent a
 * parallel token ledger.
 */

export const MARKETING_ATTR = {
  // Identity / routing
  AGENT_PROFILE: "marketing.agent.profile",
  CHANNEL: "marketing.channel",
  PRODUCT_ID: "marketing.product.id",
  ASSIGNMENT_ID: "marketing.assignment.id",
  SELECTED_AGENDA_ID: "marketing.agenda.selected_id",
  TRACE_TYPE: "marketing.trace.type",
  STAGE: "marketing.stage",
  SPAN_KIND: "marketing.span.kind",

  // Soft correlation (also on MarketingTrace root)
  PRODUCTION_REQUEST_ID: "marketing.production_request.id",
  LOGICAL_RUN_KEY: "marketing.run.logical_key",
  RUN_ID: "marketing.run.id",
  CORRELATION_ID: "marketing.run.correlation_id",
  CANDIDATE_ID: "marketing.candidate.id",
  REVIEW_ID: "marketing.review.id",
  GOVERNANCE_REVIEW_ID: "marketing.governance.review_id",
  RESEARCH_BRIEF_ID: "marketing.research.brief_id",
  AGENDA_CANDIDATE_ID: "marketing.agenda.candidate_id",
  AGENDA_SLATE_ID: "marketing.agenda.slate_id",

  // Deliverable requirements / completeness
  REQ_DESTINATION_REQUIRED: "marketing.requirements.destination.required",
  REQ_DESTINATION_COVERED: "marketing.requirements.destination.covered",
  REQ_DESTINATION_MISSING: "marketing.requirements.destination.missing",
  REQ_SECTION_REQUIRED_COUNT: "marketing.requirements.section.required_count",
  COMPLETENESS_STATUS: "marketing.completeness.status",
  COMPLETENESS_MISSING_COUNT: "marketing.completeness.missing_count",
  COMPLETENESS_FAILURE_CODES: "marketing.completeness.failure_codes",

  // Evidence pack
  EVIDENCE_AVAILABLE: "marketing.evidence.available",
  EVIDENCE_ALLOWED: "marketing.evidence.allowed",
  EVIDENCE_USED: "marketing.evidence.used",
  EVIDENCE_COVERAGE_RATIO: "marketing.evidence.coverage_ratio",

  // Revision (shared MAX_AUTO_REVISION_ROUNDS)
  REVISION_ROUND: "marketing.revision.round",
  REVISION_REASON: "marketing.revision.reason",

  // Governance
  GOVERNANCE_DECISION: "marketing.governance.decision",
  GOVERNANCE_RISK_SCORE: "marketing.governance.risk_score",
  GOVERNANCE_HUMAN_APPROVAL_REQUIRED: "marketing.governance.human_approval_required",

  // Safe summaries (never full prompt/response)
  PROMPT_TEMPLATE: "marketing.prompt.template",
  PROMPT_VERSION: "marketing.prompt.version",
  ASSIGNMENT_SUMMARY: "marketing.assignment.summary",
  RESULT_SUMMARY: "marketing.result.summary",

  // AI Runtime / GenAI semantic convention bridge
  GEN_AI_PROVIDER: "gen_ai.provider",
  GEN_AI_MODEL: "gen_ai.model",
  GEN_AI_INPUT_TOKENS: "gen_ai.usage.input_tokens",
  GEN_AI_OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  GEN_AI_TOTAL_TOKENS: "gen_ai.usage.total_tokens",
  GEN_AI_USAGE_MISSING: "gen_ai.usage.missing",
  AI_RUNTIME_REQUEST_ID: "ai_runtime.request_id",
  AI_RUNTIME_JOB_ID: "ai_runtime.job_id",
  AI_RUNTIME_CORRELATION_ID: "ai_runtime.correlation_id",
  AI_RUNTIME_EVENT_TYPE: "ai_runtime.event_type",
} as const;

export type MarketingAttrKey = (typeof MARKETING_ATTR)[keyof typeof MARKETING_ATTR];

/** Build a small attributes object from known keys only. */
export function pickMarketingAttributes(
  entries: Partial<Record<MarketingAttrKey, import("@/lib/marketing/observability/types").MarketingAttributeValue>>,
): import("@/lib/marketing/observability/types").MarketingSpanAttributes {
  const out: import("@/lib/marketing/observability/types").MarketingSpanAttributes = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;
    out[key] = value as import("@/lib/marketing/observability/types").MarketingAttributeValue;
  }
  return out;
}

/**
 * Map AI Runtime TokenUsage → gen_ai.* attributes (link, don't duplicate ledger).
 */
export function attributesFromTokenUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageMissing?: boolean;
}): import("@/lib/marketing/observability/types").MarketingSpanAttributes {
  const attrs: import("@/lib/marketing/observability/types").MarketingSpanAttributes = {};
  if (typeof usage.inputTokens === "number") attrs[MARKETING_ATTR.GEN_AI_INPUT_TOKENS] = usage.inputTokens;
  if (typeof usage.outputTokens === "number") attrs[MARKETING_ATTR.GEN_AI_OUTPUT_TOKENS] = usage.outputTokens;
  if (typeof usage.totalTokens === "number") attrs[MARKETING_ATTR.GEN_AI_TOTAL_TOKENS] = usage.totalTokens;
  if (usage.usageMissing === true) attrs[MARKETING_ATTR.GEN_AI_USAGE_MISSING] = true;
  return attrs;
}
