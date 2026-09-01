export const DAILY_MARKETING_RUN_CONTRACT = "daily-marketing-run-v1" as const;
export const COMPLETED_MARKETING_CANDIDATE_CONTRACT = "completed-marketing-candidate-v1" as const;

export const DAILY_MARKETING_ROUTINE_ID = "daily-marketing-plan" as const;

export type DailyMarketingRunStatus =
  | "started"
  | "completed"
  | "failed"
  | "deferred"
  | "skipped_idempotent";

export type DailyMarketingFailureReason =
  | "RESEARCH_EMPTY"
  | "RESEARCH_DEGRADED"
  | "RESEARCH_UNAVAILABLE"
  | "MANAGER_DEFERRED"
  | "MANAGER_INVALID_OUTPUT"
  | "ASSIGNMENT_FAILED"
  | "CONTENT_STRATEGIST_FAILED"
  | "GOVERNANCE_FAILED"
  | "GOVERNANCE_BLOCKED"
  | "PERSISTENCE_FAILED"
  | "RUNTIME_PROVIDER_FAILED";

export type CompletedMarketingCandidateStatus =
  | "ready_for_human_review"
  | "needs_human_review"
  | "blocked"
  | "failed";

export type DailyMarketingRun = {
  contract: typeof DAILY_MARKETING_RUN_CONTRACT;
  runId: string;
  logicalRunKey: string;
  businessDateKst: string;
  routineId: string;
  correlationId: string;
  executionAttempt: number;
  startedAt: string;
  completedAt: string | null;
  status: DailyMarketingRunStatus;
  researchStatus: string | null;
  selectedAgendaId: string | null;
  assignmentId: string | null;
  governanceReviewId: string | null;
  completedCandidateId: string | null;
  failureReason: DailyMarketingFailureReason | null;
  degraded: boolean;
  observability: DailyMarketingRunObservability;
  metadata: Record<string, unknown>;
};

export type DailyMarketingRunObservability = {
  runId: string;
  logicalRunKey: string;
  businessDateKst: string;
  correlationId: string;
  researchStatus: string | null;
  candidateCount: number;
  selectedAgendaId: string | null;
  assignmentId: string | null;
  governanceReviewId: string | null;
  revisionCount: number;
  governanceDecision: string | null;
  finalCandidateId: string | null;
  finalStatus: string | null;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
};

export type CompletedMarketingCandidate = {
  contract: typeof COMPLETED_MARKETING_CANDIDATE_CONTRACT;
  candidateId: string;
  runId: string;
  logicalRunKey: string;
  businessDateKst: string;
  createdAt: string;
  updatedAt: string;
  selectedAgenda: import("@/lib/marketing/content/types").SelectedAgenda;
  contentAssignment: import("@/lib/marketing/content/types").ContentAssignment;
  contentPlan: import("@/lib/marketing/content/types").ContentPlan | null;
  draft: import("@/lib/marketing/bot/organization/handoffs").ContentStrategistOutput;
  governanceDecision: import("@/lib/marketing/content/governance/types").StructuredGovernanceDecision | null;
  status: CompletedMarketingCandidateStatus;
  revisionHistory: Array<{ revisionNumber: number; governanceDecision: string | null }>;
  provenance: {
    routineId: string;
    correlationId: string;
    researchStatus: string | null;
    governanceReviewId: string | null;
  };
  observability: DailyMarketingRunObservability;
};

export type DailyMarketingPipelineInput = {
  productId: string;
  channel: string;
  goal?: string;
  businessDateKst?: string;
  correlationId?: string;
  executionAttempt?: number;
  performanceNote?: string;
  memoryReferences?: string[];
};

export type DailyMarketingPipelineResult = {
  idempotent: boolean;
  run: DailyMarketingRun;
  candidate: CompletedMarketingCandidate | null;
};
