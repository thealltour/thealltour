import type {
  CompletedMarketingCandidate,
  CompletedMarketingCandidateStatus,
  DailyMarketingRun,
} from "@/lib/marketing/cron/daily/types";
import type { DepartmentPipelineResult } from "@/lib/marketing/bot/organization/pipeline";
import type { StructuredGovernanceDecision } from "@/lib/marketing/content/governance/types";

export function mapPipelineToCandidateStatus(
  pipeline: DepartmentPipelineResult,
  governance: StructuredGovernanceDecision | null,
): CompletedMarketingCandidateStatus {
  if (pipeline.failure) return "failed";
  const decision = governance?.decision ?? pipeline.governance?.decision ?? null;
  if (decision === "ALLOW" && pipeline.status === "publish_ready") return "ready_for_human_review";
  if (decision === "REVIEW" || pipeline.status === "approval_pending") return "needs_human_review";
  if (decision === "BLOCK" || pipeline.status === "revision_required") return "blocked";
  if (governance?.malformed) return "needs_human_review";
  return "failed";
}

export function buildCompletedCandidate(input: {
  run: DailyMarketingRun;
  handoff: import("@/lib/marketing/content/types").ManagerToContentHandoffResult;
  pipeline: DepartmentPipelineResult;
  governance: StructuredGovernanceDecision | null;
  now?: Date;
}): CompletedMarketingCandidate {
  const now = input.now ?? new Date();
  const draft = input.pipeline.draft!;
  const status = mapPipelineToCandidateStatus(input.pipeline, input.governance);

  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: `cmc_${input.run.logicalRunKey.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)}`,
    runId: input.run.runId,
    logicalRunKey: input.run.logicalRunKey,
    businessDateKst: input.run.businessDateKst,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    selectedAgenda: input.handoff.selectedAgenda,
    contentAssignment: input.handoff.contentAssignment,
    contentPlan: draft.contentPlan ?? input.handoff.contentPlanScaffold,
    draft,
    governanceDecision: input.governance,
    status,
    revisionHistory: [
      {
        revisionNumber: input.pipeline.revisionRounds,
        governanceDecision: input.governance?.decision ?? input.pipeline.governance?.decision ?? null,
      },
    ],
    provenance: {
      routineId: input.run.routineId,
      correlationId: input.run.correlationId,
      researchStatus: input.run.researchStatus,
      governanceReviewId: input.governance?.reviewId ?? null,
    },
    observability: input.run.observability,
  };
}
