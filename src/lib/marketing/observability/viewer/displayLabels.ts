/**
 * Display labels for Marketing span names — UI only; does not mutate stored traces.
 */

const SPAN_NAME_LABELS: Record<string, string> = {
  "marketing.production": "Production Orchestration",
  "marketing.manager": "Marketing Manager",
  "marketing.deliverable_requirements": "Deliverable Requirements",
  "marketing.evidence_pack": "Evidence Pack Builder",
  "marketing.content_strategist": "Content Strategist",
  "marketing.completeness_validator": "Completeness Validator",
  "marketing.governance_auditor": "Governance Auditor",
  "marketing.human_review_boundary": "Human Review",
  "marketing.performance_analyst": "Performance Analyst",
};

export function marketingSpanDisplayName(name: string, attempt?: number | null): string {
  const base = SPAN_NAME_LABELS[name] ?? name;
  if (typeof attempt === "number" && attempt > 1) {
    return `${base} #${attempt}`;
  }
  return base;
}

export function marketingTraceStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "partial":
      return "PARTIAL";
    case "running":
      return "RUNNING";
    default:
      return status.toUpperCase();
  }
}
