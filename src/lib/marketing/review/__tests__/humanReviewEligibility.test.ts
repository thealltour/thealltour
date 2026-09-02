vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { GOVERNANCE_DECISION_CONTRACT } from "@/lib/marketing/content/governance/types";
import {
  bootstrapHumanReviewForCandidate,
  buildDeterministicReviewId,
  evaluateHumanReviewEligibility,
  resolveCandidateGovernanceDecision,
} from "@/lib/marketing/review/bootstrap";
import { HumanReviewEligibilityError } from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createInitialHumanReview } from "@/lib/marketing/review/dto";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { buildVerificationArtifacts } from "@/lib/marketing/review/verification/buildVerificationCandidate";
import { NOW, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";

const BUSINESS_DATE = "2026-09-02";
const LOGICAL_KEY = buildLogicalDailyRunKey({ routineId: DAILY_MARKETING_ROUTINE_ID, businessDateKst: BUSINESS_DATE });

const draft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance says autumn travel planning is easier.",
  channel: "threads",
  agenda: "Japan autumn travel update",
  sourceReferences: ["evidence:ev-official"],
};

function allow(overrides: Partial<GovernanceReviewResult> = {}): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
    ...overrides,
  };
}

function structuredDecision(decision: "ALLOW" | "REVIEW" | "BLOCK", malformed = false) {
  return {
    contract: GOVERNANCE_DECISION_CONTRACT,
    reviewId: "gr_test",
    assignmentId: "ca_test",
    decidedAt: NOW.toISOString(),
    decision,
    reasons: [],
    unsupportedClaims: [],
    factualRisks: [],
    evidenceGaps: [],
    commercialRisks: [],
    policyRisks: [],
    requiredRevisions: [],
    verifiedEvidenceRefs: [],
    riskScore: 0,
    humanApprovalRequired: decision === "REVIEW",
    semanticAvailable: true,
    revisionHints: [],
    claimCount: 0,
    unsupportedClaimCount: 0,
    evidenceGapCount: 0,
    revisionNumber: 0,
    malformed,
  };
}

async function seedCandidate(status: "ready_for_human_review" | "needs_human_review" | "blocked" | "failed") {
  const suffix = `${status}-${Math.random().toString(16).slice(2, 8)}`;
  const candidateRepo = createInMemoryDailyMarketingRunRepository();
  const handoff = prepareManagerToContentHandoff(
    { title: "Japan", summary: "Official.", idempotencyKey: `${LOGICAL_KEY}-${suffix}` },
    { now: NOW },
  );
  const pipeline = await runDepartmentPipeline(
    {
      productId: PRODUCT,
      channel: "threads",
      goal: "test",
      selectedAgenda: handoff.selectedAgenda,
      contentAssignment: handoff.contentAssignment,
      contentPlanScaffold: handoff.contentPlanScaffold,
    },
    {
      requestDraft: async () => ({ ...draft, assignmentId: handoff.contentAssignment.assignmentId }),
      requestGovernance: async () =>
        allow(
          status === "needs_human_review"
            ? { decision: "REVIEW", humanApprovalRequired: true }
            : status === "blocked"
              ? { decision: "BLOCK", revisionHints: ["fix"] }
              : {},
        ),
    },
  );

  const governanceDecision =
    status === "ready_for_human_review"
      ? structuredDecision("ALLOW")
      : status === "needs_human_review"
        ? structuredDecision("REVIEW")
        : status === "blocked"
          ? structuredDecision("BLOCK")
          : null;

  const run = {
    contract: "daily-marketing-run-v1" as const,
    runId: `run_${suffix}`,
    logicalRunKey: `${LOGICAL_KEY}-${suffix}`,
    businessDateKst: BUSINESS_DATE,
    routineId: DAILY_MARKETING_ROUTINE_ID,
    correlationId: "corr",
    executionAttempt: 1,
    startedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    status: "completed" as const,
    researchStatus: "ok",
    selectedAgendaId: handoff.selectedAgenda.id,
    assignmentId: handoff.contentAssignment.assignmentId,
    governanceReviewId: null,
    completedCandidateId: null,
    failureReason: null,
    degraded: false,
    observability: {
      runId: `run_${suffix}`,
      logicalRunKey: `${LOGICAL_KEY}-${suffix}`,
      businessDateKst: BUSINESS_DATE,
      correlationId: "corr",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: pipeline.revisionRounds,
      governanceDecision: governanceDecision?.decision ?? null,
      finalCandidateId: null,
      finalStatus: status,
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      failureReason: null,
    },
    metadata: {},
  };

  const candidate = buildCompletedCandidate({
    run,
    handoff,
    pipeline: {
      ...pipeline,
      status:
        status === "blocked"
          ? "revision_required"
          : status === "needs_human_review"
            ? "approval_pending"
            : status === "failed"
              ? "safe_stop"
              : "publish_ready",
      failure: status === "failed" ? { code: "governance_unavailable", message: "failed" } : undefined,
      draft: pipeline.draft ?? draft,
    },
    governance: governanceDecision,
    now: NOW,
  });
  candidate.status = status;
  candidate.candidateId = `cmc_test_${suffix.replace(/[^a-z0-9]+/gi, "_")}`;
  await candidateRepo.saveCandidate(candidate);
  return { candidateRepo, candidate };
}

describe("STEP 3-13 centralized Human Review eligibility", () => {
  let reviewRepo = createInMemoryHumanMarketingReviewRepository();

  beforeEach(() => {
    reviewRepo = createInMemoryHumanMarketingReviewRepository();
  });

  it("1: bootstrap and getOrCreate share centralized eligibility", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });

    const bootstrap = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(bootstrap.outcome).toBe("created");

    const viaService = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    if (bootstrap.outcome === "created") {
      expect(viaService.reviewId).toBe(bootstrap.review.reviewId);
    }
    expect((await reviewRepo.listReviews()).length).toBe(1);
  });

  it("2: getOrCreate eligible + no review creates exactly one", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    const review = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    expect(review.status).toBe("pending");
    expect((await reviewRepo.listReviews()).length).toBe(1);
  });

  it("3: getOrCreate ineligible + no review creates zero rows", async () => {
    const { candidateRepo, candidate } = await seedCandidate("blocked");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    await expect(service.getOrCreateHumanReview(candidate.candidateId, "admin")).rejects.toBeInstanceOf(
      HumanReviewEligibilityError,
    );
    expect((await reviewRepo.listReviews()).length).toBe(0);
  });

  it("4: existing human-edited review returned unchanged when bootstrap runs later", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    const existing = createInitialHumanReview(candidate, "editor", NOW);
    existing.status = "editing";
    existing.humanNotes = "keep me";
    await reviewRepo.save(existing);

    const bootstrap = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(bootstrap.outcome).toBe("reused");
    if (bootstrap.outcome === "reused") {
      expect(bootstrap.review.status).toBe("editing");
      expect(bootstrap.review.humanNotes).toBe("keep me");
    }
  });

  it("5: blocked candidate — bootstrap and getOrCreate both create zero reviews", async () => {
    const { candidateRepo, candidate } = await seedCandidate("blocked");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    const bootstrap = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(bootstrap.outcome).toBe("skipped");
    await expect(service.getOrCreateHumanReview(candidate.candidateId, "admin")).rejects.toBeInstanceOf(
      HumanReviewEligibilityError,
    );
    expect((await reviewRepo.listReviews()).length).toBe(0);
  });

  it("6: failed candidate — zero reviews through bootstrap and getOrCreate", async () => {
    const { candidateRepo, candidate } = await seedCandidate("failed");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    expect((await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW })).outcome).toBe("skipped");
    await expect(service.getOrCreateHumanReview(candidate.candidateId, "admin")).rejects.toBeInstanceOf(
      HumanReviewEligibilityError,
    );
    expect((await reviewRepo.listReviews()).length).toBe(0);
  });

  it("7: needs_human_review semantics — governance REVIEW is eligible", async () => {
    const { candidate } = await seedCandidate("needs_human_review");
    expect(resolveCandidateGovernanceDecision(candidate)).toBe("REVIEW");
    const eligibility = evaluateHumanReviewEligibility(candidate);
    expect(eligibility.eligible).toBe(true);
    const bootstrap = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(bootstrap.outcome).toBe("created");
  });

  it("7b: ready_for_human_review requires ALLOW governance when present", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    expect(resolveCandidateGovernanceDecision(candidate)).toBe("ALLOW");
    expect(evaluateHumanReviewEligibility(candidate).eligible).toBe(true);

    const corrupted = {
      ...candidate,
      governanceDecision: structuredDecision("BLOCK"),
    };
    expect(evaluateHumanReviewEligibility(corrupted).eligible).toBe(false);
  });

  it("8: getHumanReviewDetail is read-only (no review row created)", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.review).toBeNull();
    expect((await reviewRepo.listReviews()).length).toBe(0);
  });

  it("9: production deterministic review id remains stable for known candidate id", () => {
    expect(buildDeterministicReviewId("cmc_daily_marketing_plan_2026_09_02")).toBe("hmr_0893448246ea760d");
  });

  it("verification fixture excluded unless explicitly included", async () => {
    const verification = buildVerificationArtifacts(NOW);
    expect(evaluateHumanReviewEligibility(verification.candidate).eligible).toBe(false);
    expect(
      evaluateHumanReviewEligibility(verification.candidate, { includeVerification: true }).eligible,
    ).toBe(true);
  });
});
