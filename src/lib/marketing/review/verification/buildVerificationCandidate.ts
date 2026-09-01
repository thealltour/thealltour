/**
 * STEP 3-8 final verification fixture — isolated from production daily logical run.
 * Uses routineId `step-3-8-verification` so `daily-marketing-plan:{today}` is never touched.
 */
import { randomUUID } from "node:crypto";

import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import { GOVERNANCE_DECISION_CONTRACT } from "@/lib/marketing/content/governance/types";
import type { StructuredGovernanceDecision } from "@/lib/marketing/content/governance/types";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import {
  DAILY_MARKETING_RUN_CONTRACT,
  COMPLETED_MARKETING_CANDIDATE_CONTRACT,
  type CompletedMarketingCandidate,
  type DailyMarketingRun,
} from "@/lib/marketing/cron/daily/types";
import { buildLogicalDailyRunKey, formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { officialEvidence, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";

export const VERIFICATION_ROUTINE_ID = "step-3-8-verification" as const;
export const VERIFICATION_PURPOSE = "step-3-8-final-verification" as const;

export function buildVerificationIdentity(now = new Date()) {
  const businessDateKst = formatKstBusinessDate(now);
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: VERIFICATION_ROUTINE_ID,
    businessDateKst,
  });
  const candidateId = "cmc_step_3_8_verification";
  const runId = `run_${VERIFICATION_PURPOSE}`;
  return { businessDateKst, logicalRunKey, candidateId, runId, now };
}

export function buildVerificationGovernance(input: {
  assignmentId: string;
  reviewId?: string;
  now?: Date;
}): StructuredGovernanceDecision {
  const now = input.now ?? new Date();
  return {
    contract: GOVERNANCE_DECISION_CONTRACT,
    reviewId: input.reviewId ?? `gov_${VERIFICATION_PURPOSE}`,
    assignmentId: input.assignmentId,
    decidedAt: now.toISOString(),
    decision: "ALLOW",
    reasons: ["NO_RISK_SIGNAL"],
    unsupportedClaims: [],
    factualRisks: [],
    evidenceGaps: [],
    commercialRisks: [],
    policyRisks: [],
    requiredRevisions: [],
    verifiedEvidenceRefs: ["ev-official"],
    riskScore: 0,
    humanApprovalRequired: false,
    semanticAvailable: true,
    revisionHints: [],
    claimCount: 1,
    unsupportedClaimCount: 0,
    evidenceGapCount: 0,
    malformed: false,
  };
}

export function buildVerificationArtifacts(now = new Date()): {
  run: DailyMarketingRun;
  candidate: CompletedMarketingCandidate;
} {
  const identity = buildVerificationIdentity(now);
  const handoff = prepareManagerToContentHandoff(
    {
      title: "[VERIFICATION] Japan autumn travel update",
      summary: "Official guidance changed for autumn travelers. STEP 3-8 UI verification candidate.",
      rationale: ["timely official update", "verification fixture for human review UI"],
      agendaCandidateId: "ac-japan-autumn",
      researchBriefId: "rb-japan-autumn",
      researchScoreAtSelection: 0.72,
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.85)],
      matchedProductIds: [],
      idempotencyKey: identity.logicalRunKey,
      constraints: ["verification-only", "no-auto-publish"],
    },
    { now: identity.now },
  );

  const draft: ContentStrategistOutput = {
    title: "[VERIFICATION] Japan autumn update",
    body:
      "Official guidance says autumn travel planning is easier. This candidate exists only for STEP 3-8 admin review verification.",
    channel: "threads",
    agenda: handoff.selectedAgenda.title,
    sourceReferences: ["evidence:ev-official"],
    assignmentId: handoff.contentAssignment.assignmentId,
    contentPlan: handoff.contentPlanScaffold,
  };

  const governance = buildVerificationGovernance({
    assignmentId: handoff.contentAssignment.assignmentId,
    now: identity.now,
  });

  const run: DailyMarketingRun = {
    contract: DAILY_MARKETING_RUN_CONTRACT,
    runId: identity.runId,
    logicalRunKey: identity.logicalRunKey,
    businessDateKst: identity.businessDateKst,
    routineId: VERIFICATION_ROUTINE_ID,
    correlationId: `verification:${randomUUID().slice(0, 8)}`,
    executionAttempt: 1,
    startedAt: identity.now.toISOString(),
    completedAt: identity.now.toISOString(),
    status: "completed",
    researchStatus: "ok",
    selectedAgendaId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    governanceReviewId: governance.reviewId,
    completedCandidateId: identity.candidateId,
    failureReason: null,
    degraded: false,
    observability: {
      runId: identity.runId,
      logicalRunKey: identity.logicalRunKey,
      businessDateKst: identity.businessDateKst,
      correlationId: `verification:${VERIFICATION_PURPOSE}`,
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: governance.reviewId,
      revisionCount: 0,
      governanceDecision: "ALLOW",
      finalCandidateId: identity.candidateId,
      finalStatus: "ready_for_human_review",
      startedAt: identity.now.toISOString(),
      completedAt: identity.now.toISOString(),
      failureReason: null,
    },
    metadata: {
      purpose: VERIFICATION_PURPOSE,
      productId: PRODUCT,
      verification: true,
    },
  };

  const candidate: CompletedMarketingCandidate = {
    contract: COMPLETED_MARKETING_CANDIDATE_CONTRACT,
    candidateId: identity.candidateId,
    runId: identity.runId,
    logicalRunKey: identity.logicalRunKey,
    businessDateKst: identity.businessDateKst,
    createdAt: identity.now.toISOString(),
    updatedAt: identity.now.toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: handoff.contentPlanScaffold,
    draft,
    governanceDecision: governance,
    status: "ready_for_human_review",
    revisionHistory: [{ revisionNumber: 0, governanceDecision: "ALLOW" }],
    provenance: {
      routineId: VERIFICATION_ROUTINE_ID,
      correlationId: run.correlationId,
      researchStatus: "ok",
      governanceReviewId: governance.reviewId,
    },
    observability: run.observability,
  };

  return { run, candidate };
}
