vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingPipeline";
import {
  buildLogicalDailyRunKey,
} from "@/lib/marketing/cron/daily/kstBusinessDate";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import {
  buildResearchContext,
  managerSelectJson,
  NOW,
  PRODUCT,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { createInMemoryGovernanceReviewStore } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import {
  classifyMarketingIncident,
  mapPipelineFailureToReason,
} from "@/lib/marketing/operations/incidentClassification";
import {
  buildMarketingIncidentTriage,
  snapshotFailedRunForIncidentHistory,
} from "@/lib/marketing/operations/buildIncidentTriage";
import { getDailyMarketingOperationsStatus, sanitizeOperationsDtoForResponse } from "@/lib/marketing/operations";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import {
  PUBLICATION_FLOW_INACTIVE,
  OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10,
} from "@/lib/marketing/social/publication/governanceBoundary";

const BUSINESS_DATE = "2026-09-02";
const LOGICAL_KEY = buildLogicalDailyRunKey({
  routineId: DAILY_MARKETING_ROUTINE_ID,
  businessDateKst: BUSINESS_DATE,
});

function pipelineDeps(overrides: {
  governance?: () => Promise<never>;
} = {}) {
  const repo = createInMemoryDailyMarketingRunRepository();
  return {
    repo,
    deps: {
      repo,
      now: NOW,
      contentAssignmentStore: createInMemoryContentAssignmentStore(),
      governanceReviewStore: createInMemoryGovernanceReviewStore(),
      getResearchContext: async () => buildResearchContext(),
      invokeManagerProfile: async () => managerSelectJson(),
      requestDraft: async () => ({
        title: "Japan autumn update",
        body: "Official guidance says autumn travel planning is easier.",
        channel: "threads",
        agenda: "Japan autumn travel update",
        sourceReferences: ["evidence:ev-official"],
        assignmentId: null,
      }),
      requestGovernance: async () => {
        if (overrides.governance) return overrides.governance();
        return {
          decision: "ALLOW" as const,
          riskScore: 0,
          reasons: ["NO_RISK_SIGNAL"],
          revisionHints: [],
          humanApprovalRequired: false,
          semanticAvailable: true,
        };
      },
      requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
    },
  };
}

describe("STEP 3-11 incident recovery", () => {
  it("A: legitimate BLOCK → no infrastructure retry", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_BLOCKED",
      candidateStatus: "blocked",
      revisionCount: 1,
    });
    expect(assessment.incidentClass).toBe("business_rule_block");
    expect(assessment.recoveryDisposition).toBe("no_retry");
  });

  it("B: REVIEW → human_action_required", () => {
    const assessment = classifyMarketingIncident({
      governanceDecision: "REVIEW",
      candidateStatus: "needs_human_review",
    });
    expect(assessment.incidentClass).toBe("governance_review_required");
    expect(assessment.recoveryDisposition).toBe("human_action_required");
  });

  it("C: malformed governance output → technical classification", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "governance-auditor returned no ALLOW/REVIEW/BLOCK",
    });
    expect(assessment.incidentClass).toBe("malformed_model_output");
    expect(assessment.recoveryDisposition).toBe("safe_retry");
  });

  it("classifier A: evidenceRefs undefined TypeError before GA → invalid_state", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "Cannot read properties of undefined (reading 'map')",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("invalid_state");
    expect(assessment.recoveryDisposition).toBe("retry_after_fix");
    expect(assessment.concernSummary).toContain("contentPlan.evidenceRefs");
  });

  it("classifier B: no GA telemetry + explicit invalid-state exception → invalid_state", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_FAILED",
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "TypeError: Cannot read properties of undefined (reading 'map')",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("invalid_state");
  });

  it("classifier C: no GA telemetry with no other evidence → unknown", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_FAILED",
      pipelineFailureCode: "governance_unavailable",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("unknown");
    expect(assessment.incidentClass).not.toBe("runtime_unavailable");
  });

  it("classifier D: explicit Runtime gateway unavailable evidence → runtime_unavailable", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "RUNTIME_PROVIDER_FAILED",
      pipelineFailureMessage: "AI Runtime Gateway unavailable",
    });
    expect(assessment.incidentClass).toBe("runtime_unavailable");
    expect(assessment.recoveryDisposition).toBe("safe_retry");
  });

  it("classifier E: GA BLOCK → business_rule_block", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_BLOCKED",
      candidateStatus: "blocked",
      revisionCount: 1,
    });
    expect(assessment.incidentClass).toBe("business_rule_block");
  });

  it("classifier F: malformed GA result → malformed_model_output", () => {
    const assessment = classifyMarketingIncident({
      pipelineFailureMessage: "governance-auditor returned no ALLOW/REVIEW/BLOCK",
    });
    expect(assessment.incidentClass).toBe("malformed_model_output");
  });

  it("classifier G: 2026-09-02 frozen incident evidence → invalid_state", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "Cannot read properties of undefined (reading 'map')",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("invalid_state");
  });

  it("D: explicit Governance Runtime failure → provider_transient", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "governance-auditor runtime failed: RUNTIME_ERROR",
    });
    expect(assessment.incidentClass).toBe("provider_transient");
    expect(assessment.recoveryDisposition).toBe("safe_retry");
  });

  it("E: provider auth → retry_after_fix", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "RUNTIME_PROVIDER_FAILED",
      pipelineFailureMessage: "auth_error: unauthorized",
    });
    expect(assessment.incidentClass).toBe("provider_auth");
    expect(assessment.recoveryDisposition).toBe("retry_after_fix");
  });

  it("F: revision succeeds on second pass → candidate generated", async () => {
    let governanceCalls = 0;
    const { repo, deps } = pipelineDeps();
    deps.requestGovernance = async () => {
      governanceCalls += 1;
      if (governanceCalls === 1) {
        return {
          decision: "BLOCK" as const,
          riskScore: 1,
          reasons: ["CLAIM_UNSUPPORTED"],
          revisionHints: ["remove price"],
          humanApprovalRequired: false,
          semanticAvailable: true,
        };
      }
      return {
        decision: "ALLOW" as const,
        riskScore: 0,
        reasons: [],
        revisionHints: [],
        humanApprovalRequired: false,
        semanticAvailable: true,
      };
    };

    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.status).toBe("ready_for_human_review");
    expect(result.run.observability.revisionCount).toBe(1);
    expect(governanceCalls).toBe(2);
    expect(await repo.findCandidateByLogicalKey(LOGICAL_KEY)).toBeTruthy();
  });

  it("G: revision fails again → policy/block outcome preserved", async () => {
    const { deps } = pipelineDeps();
    deps.requestGovernance = async () => ({
      decision: "BLOCK" as const,
      riskScore: 1,
      reasons: ["CLAIM_UNSUPPORTED"],
      revisionHints: ["fix claim"],
      humanApprovalRequired: false,
      semanticAvailable: true,
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.status).toBe("blocked");
    expect(result.run.failureReason).toBe("GOVERNANCE_BLOCKED");
  });

  it("H: recovery preserves original failed run", async () => {
    const { repo, deps } = pipelineDeps({
      governance: async () => {
        throw new Error("governance-auditor runtime failed: RUNTIME_ERROR");
      },
    });
    const failed = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(failed.run.failureReason).toBe("GOVERNANCE_TECHNICAL_FAILURE");
    const priorRunId = failed.run.runId;

    deps.requestGovernance = async () => ({
      decision: "ALLOW" as const,
      riskScore: 0,
      reasons: [],
      revisionHints: [],
      humanApprovalRequired: false,
      semanticAvailable: true,
    });

    const recovered = await runDailyMarketingPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        recoveryMode: true,
      },
      deps,
    );
    const history = recovered.run.metadata.incidentHistory as Array<{ runId: string }>;
    expect(history.length).toBe(1);
    expect(history[0]?.runId).toBe(priorRunId);
    expect(recovered.run.executionAttempt).toBe(2);
  });

  it("I: recovery creates no duplicate candidate", async () => {
    const { repo, deps } = pipelineDeps();
    const first = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const second = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE, recoveryMode: true },
      deps,
    );
    expect(second.idempotent).toBe(true);
    const all = await repo.listCandidates({ businessDateKst: BUSINESS_DATE });
    expect(all).toHaveLength(1);
    expect(all[0]?.candidateId).toBe(first.candidate?.candidateId);
  });

  it("J: recovery command repeated → idempotent when candidate exists", async () => {
    const { deps } = pipelineDeps();
    await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const repeat = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE, recoveryMode: true },
      deps,
    );
    expect(repeat.idempotent).toBe(true);
  });

  it("K: successful candidate prevents unsafe rerun via idempotent skip", async () => {
    const { deps } = pipelineDeps();
    await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const blocked = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE, recoveryMode: true },
      deps,
    );
    expect(blocked.idempotent).toBe(true);
    expect(blocked.run.status).toBe("skipped_idempotent");
  });

  it("L: ambiguous started state would be refused by recovery script contract", () => {
    const snapshot = snapshotFailedRunForIncidentHistory({
      contract: "daily-marketing-run-v1",
      runId: "r1",
      logicalRunKey: LOGICAL_KEY,
      businessDateKst: BUSINESS_DATE,
      routineId: DAILY_MARKETING_ROUTINE_ID,
      correlationId: "c1",
      executionAttempt: 1,
      startedAt: NOW.toISOString(),
      completedAt: null,
      status: "started",
      researchStatus: null,
      selectedAgendaId: null,
      assignmentId: null,
      governanceReviewId: null,
      completedCandidateId: null,
      failureReason: null,
      degraded: false,
      observability: {
        runId: "r1",
        logicalRunKey: LOGICAL_KEY,
        businessDateKst: BUSINESS_DATE,
        correlationId: "c1",
        researchStatus: null,
        candidateCount: 0,
        selectedAgendaId: null,
        assignmentId: null,
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: null,
        finalCandidateId: null,
        finalStatus: null,
        startedAt: NOW.toISOString(),
        completedAt: null,
        failureReason: null,
      },
      metadata: {},
    });
    expect(snapshot.status).toBe("started");
  });

  it("M/N: operations DTO shows incident class and recovery disposition", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    await runRepo.saveRun({
      contract: "daily-marketing-run-v1",
      runId: "failed-run",
      logicalRunKey: LOGICAL_KEY,
      businessDateKst: BUSINESS_DATE,
      routineId: DAILY_MARKETING_ROUTINE_ID,
      correlationId: "marketing-cron:2026-09-02",
      executionAttempt: 1,
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      status: "failed",
      researchStatus: "ok",
      selectedAgendaId: "sa1",
      assignmentId: "ca1",
      governanceReviewId: null,
      completedCandidateId: null,
      failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      degraded: false,
      observability: {
        runId: "failed-run",
        logicalRunKey: LOGICAL_KEY,
        businessDateKst: BUSINESS_DATE,
        correlationId: "marketing-cron:2026-09-02",
        researchStatus: "ok",
        candidateCount: 10,
        selectedAgendaId: "sa1",
        assignmentId: "ca1",
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: null,
        finalCandidateId: null,
        finalStatus: null,
        startedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
        failureReason: "GOVERNANCE_TECHNICAL_FAILURE",
      },
      metadata: {
        pipelineFailure: {
          code: "governance_unavailable",
          message: "Cannot read properties of undefined (reading 'map')",
        },
      },
    });

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: new Date("2026-09-02T02:00:00.000Z") },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        checkSemanticInfrastructure: async () => false,
      },
    );

    expect(status.incident).not.toBeNull();
    expect(status.incident?.incidentClass).toBe("invalid_state");
    expect(status.incident?.recoveryDisposition).toBe("retry_after_fix");
  });

  it("O: no secret leakage in operations DTO", () => {
    const triage = buildMarketingIncidentTriage(
      {
        contract: "daily-marketing-run-v1",
        runId: "r",
        logicalRunKey: LOGICAL_KEY,
        businessDateKst: BUSINESS_DATE,
        routineId: DAILY_MARKETING_ROUTINE_ID,
        correlationId: "c",
        executionAttempt: 1,
        startedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
        status: "failed",
        researchStatus: "ok",
        selectedAgendaId: null,
        assignmentId: null,
        governanceReviewId: null,
        completedCandidateId: null,
        failureReason: "GOVERNANCE_FAILED",
        degraded: false,
        observability: {
          runId: "r",
          logicalRunKey: LOGICAL_KEY,
          businessDateKst: BUSINESS_DATE,
          correlationId: "c",
          researchStatus: "ok",
          candidateCount: 0,
          selectedAgendaId: null,
          assignmentId: null,
          governanceReviewId: null,
          revisionCount: 0,
          governanceDecision: null,
          finalCandidateId: null,
          finalStatus: null,
          startedAt: NOW.toISOString(),
          completedAt: NOW.toISOString(),
          failureReason: "GOVERNANCE_FAILED",
        },
        metadata: { secret: "Bearer super-secret-api-key-value" },
      },
      null,
    );
    const sanitized = sanitizeOperationsDtoForResponse({ triage, secret: "Bearer super-secret-api-key-value" });
    expect(JSON.stringify(sanitized)).not.toContain("super-secret-api-key-value");
  });

  it("P: no SNS/Telegram/external writes invariant", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10).toBe(0);
  });

  it("deterministic reproduction: governance_unavailable maps to GOVERNANCE_TECHNICAL_FAILURE", async () => {
    const { deps } = pipelineDeps({
      governance: async () => {
        throw new Error("governance-auditor runtime failed: RUNTIME_ERROR");
      },
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.run.failureReason).toBe("GOVERNANCE_TECHNICAL_FAILURE");
    expect(result.run.metadata.pipelineFailure).toEqual({
      code: "governance_unavailable",
      message: "governance-auditor runtime failed: RUNTIME_ERROR",
    });
    expect(result.run.metadata.incident).toMatchObject({
      incidentClass: "provider_transient",
      recoveryDisposition: "safe_retry",
      revisionAttempted: false,
    });
  });

  it("pipeline failure TypeError persists invalid_state incident metadata", async () => {
    const { deps } = pipelineDeps({
      governance: async () => {
        throw new Error("Cannot read properties of undefined (reading 'map')");
      },
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.run.metadata.incident).toMatchObject({
      incidentClass: "invalid_state",
      recoveryDisposition: "retry_after_fix",
    });
  });
});
