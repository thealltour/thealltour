import { MARKETING_ATTR } from "@/lib/marketing/observability/attributes";
import type { MarketingSpan, MarketingTrace } from "@/lib/marketing/observability/types";
import { presentBusinessStatus } from "@/lib/marketing/observability/viewer/businessStatus";
import { marketingSpanDisplayName } from "@/lib/marketing/observability/viewer/displayLabels";

export type DetailRow = {
  label: string;
  value: string;
};

export type DetailGroup = {
  id: string;
  title: string;
  rows: DetailRow[];
};

function dash(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function push(rows: DetailRow[], label: string, value: unknown) {
  const rendered = dash(value);
  if (rendered == null) return;
  rows.push({ label, value: rendered });
}

function attr(span: MarketingSpan, key: string): unknown {
  return span.attributes?.[key];
}

/**
 * Group sanitized stored attributes for the admin details panel.
 * Missing values are omitted (never invented as 0).
 */
export function buildSpanDetailGroups(
  span: MarketingSpan,
  trace?: MarketingTrace | null,
): DetailGroup[] {
  const groups: DetailGroup[] = [];
  const biz = presentBusinessStatus(span.status, span.otelStatusCode);

  const execution: DetailRow[] = [];
  push(execution, "Status", biz.label);
  if (biz.isTechnicalError) push(execution, "Technical", "OTel ERROR");
  push(execution, "Attempt", span.attempt);
  push(execution, "Duration", span.durationMs != null ? `${(span.durationMs / 1000).toFixed(1)}s` : null);
  push(execution, "Actor type", span.actorType);
  push(execution, "Profile", span.actorId);
  push(execution, "Stage", span.stage);
  push(execution, "Kind", span.kind);
  push(execution, "Span", marketingSpanDisplayName(span.name, span.attempt));
  groups.push({ id: "execution", title: "Execution", rows: execution });

  const quality: DetailRow[] = [];
  push(quality, "Destination required", attr(span, MARKETING_ATTR.REQ_DESTINATION_REQUIRED));
  push(quality, "Destination covered", attr(span, MARKETING_ATTR.REQ_DESTINATION_COVERED));
  push(quality, "Destination missing", attr(span, MARKETING_ATTR.REQ_DESTINATION_MISSING));
  push(quality, "Evidence available", attr(span, MARKETING_ATTR.EVIDENCE_AVAILABLE));
  push(quality, "Evidence allowed", attr(span, MARKETING_ATTR.EVIDENCE_ALLOWED));
  push(quality, "Evidence used", attr(span, MARKETING_ATTR.EVIDENCE_USED));
  push(quality, "Completeness", attr(span, MARKETING_ATTR.COMPLETENESS_STATUS));
  push(quality, "Missing count", attr(span, MARKETING_ATTR.COMPLETENESS_MISSING_COUNT));
  push(quality, "Failure codes", attr(span, MARKETING_ATTR.COMPLETENESS_FAILURE_CODES));
  push(quality, "Revision round", attr(span, MARKETING_ATTR.REVISION_ROUND));
  push(quality, "Revision reason", attr(span, MARKETING_ATTR.REVISION_REASON));
  if (quality.length) groups.push({ id: "quality", title: "Content Quality", rows: quality });

  const governance: DetailRow[] = [];
  push(governance, "Decision", attr(span, MARKETING_ATTR.GOVERNANCE_DECISION));
  push(governance, "Risk score", attr(span, MARKETING_ATTR.GOVERNANCE_RISK_SCORE));
  push(governance, "Human approval", attr(span, MARKETING_ATTR.GOVERNANCE_HUMAN_APPROVAL_REQUIRED));
  if (governance.length) groups.push({ id: "governance", title: "Governance", rows: governance });

  const runtime: DetailRow[] = [];
  push(runtime, "Provider", attr(span, MARKETING_ATTR.GEN_AI_PROVIDER));
  push(runtime, "Model", attr(span, MARKETING_ATTR.GEN_AI_MODEL));
  push(runtime, "Input tokens", attr(span, MARKETING_ATTR.GEN_AI_INPUT_TOKENS));
  push(runtime, "Output tokens", attr(span, MARKETING_ATTR.GEN_AI_OUTPUT_TOKENS));
  push(runtime, "Total tokens", attr(span, MARKETING_ATTR.GEN_AI_TOTAL_TOKENS));
  push(runtime, "Request id", attr(span, MARKETING_ATTR.AI_RUNTIME_REQUEST_ID));
  push(runtime, "Job id", attr(span, MARKETING_ATTR.AI_RUNTIME_JOB_ID));
  if (runtime.length) groups.push({ id: "runtime", title: "AI Runtime", rows: runtime });

  const correlation: DetailRow[] = [];
  push(correlation, "ProductionRequest", trace?.productionRequestId ?? attr(span, MARKETING_ATTR.PRODUCTION_REQUEST_ID));
  push(correlation, "Assignment", trace?.assignmentId ?? attr(span, MARKETING_ATTR.ASSIGNMENT_ID));
  push(correlation, "AgendaCandidate", trace?.agendaCandidateId ?? attr(span, MARKETING_ATTR.AGENDA_CANDIDATE_ID));
  push(correlation, "CompletedCandidate", trace?.candidateId ?? attr(span, MARKETING_ATTR.CANDIDATE_ID));
  push(correlation, "HMR", trace?.reviewId ?? attr(span, MARKETING_ATTR.REVIEW_ID));
  push(correlation, "Logical run", trace?.logicalRunKey ?? attr(span, MARKETING_ATTR.LOGICAL_RUN_KEY));
  if (correlation.length) groups.push({ id: "correlation", title: "Correlation", rows: correlation });

  if (span.error) {
    const errorRows: DetailRow[] = [];
    push(errorRows, "Class", span.error.class);
    push(errorRows, "Code", span.error.pipelineFailureCode);
    push(errorRows, "Message", span.error.message);
    groups.push({ id: "error", title: "Error", rows: errorRows });
  }

  return groups;
}
