import type { MarketingIncidentClass } from "@/lib/marketing/operations/incidentClassification";

/**
 * OBS-1 span/trace error taxonomy.
 * Prefer mapping from existing {@link MarketingIncidentClass} rather than inventing
 * a second incident system.
 */
export type MarketingTraceErrorClass =
  | "invocation_failure"
  | "timeout"
  | "schema_failure"
  | "grounding_failure"
  | "completeness_failure"
  | "governance_block"
  | "governance_review"
  | "quota_failure"
  | "provider_failure"
  | "persistence_failure"
  | "invalid_state"
  | "business_rule_block"
  | "unknown";

const INCIDENT_TO_TRACE_ERROR: Record<MarketingIncidentClass, MarketingTraceErrorClass> = {
  hermes_invocation_failure: "invocation_failure",
  tool_failure: "invocation_failure",
  timeout: "timeout",
  malformed_model_output: "schema_failure",
  provider_transient: "provider_failure",
  provider_auth: "provider_failure",
  runtime_unavailable: "provider_failure",
  persistence_failure: "persistence_failure",
  business_rule_block: "business_rule_block",
  governance_review_required: "governance_review",
  invalid_state: "invalid_state",
  unknown: "unknown",
};

export function mapIncidentClassToTraceError(
  incidentClass: MarketingIncidentClass | string | null | undefined,
): MarketingTraceErrorClass {
  if (!incidentClass) return "unknown";
  if (incidentClass in INCIDENT_TO_TRACE_ERROR) {
    return INCIDENT_TO_TRACE_ERROR[incidentClass as MarketingIncidentClass];
  }
  // Pipeline / completeness message hints when incident not yet classified
  const lower = String(incidentClass).toLowerCase();
  if (lower.includes("completeness")) return "completeness_failure";
  if (lower.includes("grounding") || lower.includes("evidence_refs")) return "grounding_failure";
  if (lower.includes("quota")) return "quota_failure";
  if (lower.includes("governance") && lower.includes("block")) return "governance_block";
  if (lower.includes("timeout")) return "timeout";
  return "unknown";
}

/** Infer OBS-1 error class from pipeline failure code/message when incident absent. */
export function inferTraceErrorFromPipelineFailure(input: {
  code?: string | null;
  message?: string | null;
}): MarketingTraceErrorClass {
  const blob = `${input.code ?? ""} ${input.message ?? ""}`.toLowerCase();
  if (!blob.trim()) return "unknown";
  if (blob.includes("completeness")) return "completeness_failure";
  if (blob.includes("grounding") || blob.includes("evidence_refs")) return "grounding_failure";
  if (blob.includes("malformed") || blob.includes("schema") || blob.includes("format_failed")) {
    return "schema_failure";
  }
  if (blob.includes("timeout")) return "timeout";
  if (blob.includes("quota")) return "quota_failure";
  if (blob.includes("persist")) return "persistence_failure";
  if (blob.includes("governance") && blob.includes("block")) return "governance_block";
  if (blob.includes("hermes") || blob.includes("invocation") || blob.includes("content_unavailable")) {
    return "invocation_failure";
  }
  if (blob.includes("provider") || blob.includes("runtime")) return "provider_failure";
  return "unknown";
}
