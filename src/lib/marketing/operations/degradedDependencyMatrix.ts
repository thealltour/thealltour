export type DegradedDependencyScenario =
  | "bge_unavailable"
  | "research_collector_partial"
  | "research_collectors_all_unavailable"
  | "supabase_read_failure"
  | "supabase_write_failure"
  | "runtime_gateway_unavailable"
  | "model_provider_fallback"
  | "performance_repo_unavailable"
  | "no_performance_data"
  | "poisoned_persisted_row";

export type DegradedDependencyBehavior = {
  scenario: DegradedDependencyScenario;
  expectedStatus: "healthy" | "degraded" | "failed" | "action_required";
  cycleContinues: boolean;
  failsClosed: boolean;
  operatorActionRequired: boolean;
  automaticRetry: string;
  notes: string;
};

export const DEGRADED_DEPENDENCY_MATRIX: DegradedDependencyBehavior[] = [
  {
    scenario: "bge_unavailable",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: false,
    automaticRetry: "Next research collection cycle; embedding provider health check on MM context load.",
    notes: "Lexical dedup fallback used. MM research context returns degraded but persisted research remains available.",
  },
  {
    scenario: "research_collector_partial",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: false,
    automaticRetry: "Next manual or scheduled research-collection-run.ts execution.",
    notes: "Other collectors and performance feedback may still succeed.",
  },
  {
    scenario: "research_collectors_all_unavailable",
    expectedStatus: "degraded",
    cycleContinues: false,
    failsClosed: true,
    operatorActionRequired: true,
    automaticRetry: "None in-repo; operator reruns research-collection-run.ts after dependency recovery.",
    notes: "09:00 pipeline may defer/fail with RESEARCH_EMPTY or RESEARCH_UNAVAILABLE if no persisted briefs exist.",
  },
  {
    scenario: "supabase_read_failure",
    expectedStatus: "failed",
    cycleContinues: false,
    failsClosed: true,
    operatorActionRequired: true,
    automaticRetry: "Hermes cron may retry next schedule tick; no in-script retry loop.",
    notes: "Operations status unavailable; PA/MM scripts exit non-zero when required reads fail.",
  },
  {
    scenario: "supabase_write_failure",
    expectedStatus: "failed",
    cycleContinues: false,
    failsClosed: true,
    operatorActionRequired: true,
    automaticRetry: "Operator reruns affected script after DB recovery.",
    notes: "09:00 pipeline surfaces PERSISTENCE_FAILED; no partial candidate without persisted run.",
  },
  {
    scenario: "runtime_gateway_unavailable",
    expectedStatus: "failed",
    cycleContinues: false,
    failsClosed: true,
    operatorActionRequired: true,
    automaticRetry: "Hermes cron retry; fallback to Hermes CLI profiles when AI_RUNTIME_MARKETING_CRON_ENABLED=false.",
    notes: "Manager/CS/GA dispatch fails with RUNTIME_PROVIDER_FAILED.",
  },
  {
    scenario: "model_provider_fallback",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: false,
    automaticRetry: "Runtime routing policy handles provider fallback internally.",
    notes: "Candidate may still be produced; observability should note degraded model route.",
  },
  {
    scenario: "performance_repo_unavailable",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: false,
    automaticRetry: "Next research-collection-run.ts; performance feedback source marked degraded only.",
    notes: "Research cycle and 09:00 pipeline continue; optional feedback omitted.",
  },
  {
    scenario: "no_performance_data",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: false,
    automaticRetry: "Manual performance collection script when manually published content exists.",
    notes: "Not a system failure. PA brief reports unavailable/partial metrics.",
  },
  {
    scenario: "poisoned_persisted_row",
    expectedStatus: "degraded",
    cycleContinues: true,
    failsClosed: false,
    operatorActionRequired: true,
    automaticRetry: "None automatic; operator cleans or quarantines invalid row.",
    notes: "Invalid claim_source and similar fields are sanitized on read where possible.",
  },
];

export const OBSERVABILITY_GAPS = [
  { rank: "high" as const, gap: "Hermes Routine scheduler last-run state is not persisted centrally in Supabase." },
  { rank: "high" as const, gap: "08:30 PA artifact history is single-file only (latest-performance-brief.json)." },
  { rank: "medium" as const, gap: "Research collection has no scheduled production cron; operator must verify manual runs." },
  { rank: "medium" as const, gap: "systemd/hermes.service restart history is outside application observability." },
  { rank: "medium" as const, gap: "Live provider metrics remain unexercised; PA cannot confirm SNS-side metrics." },
  { rank: "low" as const, gap: "No push/Telegram/Desktop proactive operator alerts for failed stages." },
  { rank: "low" as const, gap: "No automated incident ticketing or on-call routing." },
] as const;
