import { randomUUID } from "node:crypto";

import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingPipeline";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { createInitialHumanReview } from "@/lib/marketing/review/dto";
import {
  bootstrapHumanReviewForCandidate,
  bootstrapMissingHumanMarketingReviews,
  buildDeterministicReviewId,
} from "@/lib/marketing/review/bootstrap";
import { isCandidateEligibleForHumanReview } from "@/lib/marketing/review/bootstrap/eligibility";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { buildActionRequiredReasons } from "@/lib/marketing/operations/healthRules";
import { buildVerificationArtifacts } from "@/lib/marketing/review/verification/buildVerificationCandidate";
import { NOW, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS } from "@/lib/marketing/review/index";
import {
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_8,
} from "@/lib/marketing/social/publication/governanceBoundary";

const BUSINESS_DATE = "2026-09-02";
const LOGICAL_KEY = buildLogicalDailyRunKey({
  routineId: DAILY_MARKETING_ROUTINE_ID,
  businessDateKst: BUSINESS_DATE,
});

const draft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance changed.",
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

async function seedCandidate(status: "ready_for_human_review" | "needs_human_review" | "blocked" | "failed") {
  const suffix = `${status}-${randomUUID().slice(0, 8)}`;
  const candidateRepo = createInMemoryDailyMarketingRunRepository();
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Japan autumn travel update",
      summary: "Official guidance changed.",
      idempotencyKey: `${LOGICAL_KEY}-${suffix}`,
    },
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

  const run = {
    contract: "daily-marketing-run-v1" as const,
    runId: `run_${status}`,
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
      runId: `run_${status}`,
      logicalRunKey: `${LOGICAL_KEY}-${suffix}`,
      businessDateKst: BUSINESS_DATE,
      correlationId: "corr",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: pipeline.revisionRounds,
      governanceDecision: pipeline.governance?.decision ?? null,
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
      status: status === "blocked" ? "revision_required" : status === "failed" ? "safe_stop" : "publish_ready",
      failure: status === "failed" ? { code: "governance_unavailable", message: "failed" } : undefined,
      draft: pipeline.draft ?? draft,
    },
    governance: null,
    now: NOW,
  });
  candidate.status = status;
  candidate.candidateId = `cmc_test_${suffix.replace(/[^a-z0-9]+/gi, "_")}`;
  await candidateRepo.saveCandidate(candidate);
  return { candidateRepo, candidate };
}

describe("STEP 3-13 Human Review bootstrap", () => {
  let reviewRepo = createInMemoryHumanMarketingReviewRepository();

  beforeEach(() => {
    reviewRepo = createInMemoryHumanMarketingReviewRepository();
  });

  it("1-2: eligible ready_for_human_review candidate creates pending review", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    const result = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;
    expect(result.review.status).toBe("pending");
    expect(result.review.candidateId).toBe(candidate.candidateId);
    expect(result.review.approvedAt).toBeNull();
    expect(result.review.manualPublication).toBeNull();
    expect(result.review.manuallyPublishedAt).toBeNull();
  });

  it("3: same candidate bootstrap twice yields exactly one review", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    const first = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    const second = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("reused");
    if (first.outcome === "created" && second.outcome === "reused") {
      expect(second.review.reviewId).toBe(first.review.reviewId);
    }
    expect((await reviewRepo.listReviews()).length).toBe(1);
  });

  it("4: concurrent bootstrap attempts resolve to one review", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW })),
    );
    const reviewIds = new Set(
      results
        .filter((result): result is Extract<typeof result, { outcome: "created" | "reused" }> =>
          result.outcome === "created" || result.outcome === "reused",
        )
        .map((result) => result.review.reviewId),
    );
    expect(reviewIds.size).toBe(1);
    expect((await reviewRepo.listReviews()).length).toBe(1);
    expect(results.every((result) => result.outcome === "created" || result.outcome === "reused")).toBe(true);
  });

  it("5-8: existing human states are preserved, not reset to pending", async () => {
    const editingSeed = await seedCandidate("ready_for_human_review");
    const editingReview = createInitialHumanReview(
      editingSeed.candidate,
      "editor",
      NOW,
      buildDeterministicReviewId(editingSeed.candidate.candidateId),
    );
    editingReview.status = "editing";
    editingReview.humanNotes = "operator edit";
    await reviewRepo.save(editingReview);
    const reusedEditing = await bootstrapHumanReviewForCandidate(editingSeed.candidate, { reviewRepo, now: () => NOW });
    expect(reusedEditing.outcome).toBe("reused");
    if (reusedEditing.outcome === "reused") {
      expect(reusedEditing.review.status).toBe("editing");
      expect(reusedEditing.review.humanNotes).toBe("operator edit");
    }

    const approvedSeed = await seedCandidate("ready_for_human_review");
    const approvedReview = createInitialHumanReview(
      approvedSeed.candidate,
      "approver",
      NOW,
      buildDeterministicReviewId(approvedSeed.candidate.candidateId),
    );
    approvedReview.status = "approved_for_manual_publish";
    approvedReview.approvedAt = NOW.toISOString();
    await reviewRepo.save(approvedReview);
    const reusedApproved = await bootstrapHumanReviewForCandidate(approvedSeed.candidate, { reviewRepo, now: () => NOW });
    expect(reusedApproved.outcome).toBe("reused");
    if (reusedApproved.outcome === "reused") {
      expect(reusedApproved.review.status).toBe("approved_for_manual_publish");
    }

    const publishedSeed = await seedCandidate("ready_for_human_review");
    const publishedReview = createInitialHumanReview(
      publishedSeed.candidate,
      "publisher",
      NOW,
      buildDeterministicReviewId(publishedSeed.candidate.candidateId),
    );
    publishedReview.status = "manually_published";
    publishedReview.manualPublication = { platform: "threads", publishedAt: NOW.toISOString() };
    publishedReview.manuallyPublishedAt = NOW.toISOString();
    await reviewRepo.save(publishedReview);
    const reusedPublished = await bootstrapHumanReviewForCandidate(publishedSeed.candidate, { reviewRepo, now: () => NOW });
    expect(reusedPublished.outcome).toBe("reused");
    if (reusedPublished.outcome === "reused") {
      expect(reusedPublished.review.status).toBe("manually_published");
    }
  });

  it("9-12: ineligible candidates do not bootstrap reviews", async () => {
    for (const status of ["blocked", "failed"] as const) {
      const { candidate } = await seedCandidate(status);
      const result = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
      expect(result.outcome).toBe("skipped");
      expect(isCandidateEligibleForHumanReview(candidate)).toBe(false);
    }
    expect((await reviewRepo.listReviews()).length).toBe(0);
  });

  it("13: bootstrap failure leaves candidate intact", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    const failingRepo = {
      ...reviewRepo,
      save: async () => {
        throw new Error("db_unavailable");
      },
    };
    const result = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo: failingRepo, now: () => NOW });
    expect(result.outcome).toBe("failed");
    const stillThere = await candidateRepo.findCandidateByCandidateId(candidate.candidateId);
    expect(stillThere?.status).toBe("ready_for_human_review");
  });

  it("15-16: queue and detail read bootstrapped pending review", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
    const queue = await service.listHumanReviewQueue("pending");
    expect(queue.items.some((item) => item.candidateId === candidate.candidateId)).toBe(true);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.review?.status).toBe("pending");
    expect(detail?.canApprove).toBe(true);
  });

  it("17-18: operations distinguish missing review vs pending human review", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    expect(
      buildActionRequiredReasons({ candidate, review: null }).some((reason) =>
        reason.includes("bootstrap is missing"),
      ),
    ).toBe(true);

    const bootstrapped = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(bootstrapped.outcome).toBe("created");
    const review = bootstrapped.outcome === "created" ? bootstrapped.review : null;
    expect(review?.status).toBe("pending");
    expect(
      buildActionRequiredReasons({ candidate, review }).some((reason) => reason.includes("ready for human review")),
    ).toBe(true);
    expect(
      buildActionRequiredReasons({ candidate, review }).some((reason) => reason.includes("bootstrap is missing")),
    ).toBe(false);
  });

  it("19-24: no approval/publication/SNS side effects on bootstrap", async () => {
    const { candidate } = await seedCandidate("ready_for_human_review");
    const result = await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;
    expect(result.review.status).not.toBe("approved_for_manual_publish");
    expect(result.review.manualPublication).toBeNull();
    expect(HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS).toBe(0);
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
  });

  it("25-26: backfill first creates one, second creates zero additional rows", async () => {
    const { candidateRepo, candidate } = await seedCandidate("ready_for_human_review");
    const first = await bootstrapMissingHumanMarketingReviews({ candidateRepo, reviewRepo, now: () => NOW });
    expect(first.created).toBe(1);
    expect(first.reused).toBe(0);
    const second = await bootstrapMissingHumanMarketingReviews({ candidateRepo, reviewRepo, now: () => NOW });
    expect(second.created).toBe(0);
    expect(second.reused).toBe(1);
    expect((await reviewRepo.listReviews()).length).toBe(1);
  });

  it("verification fixture excluded unless explicitly included", async () => {
    const verification = buildVerificationArtifacts(NOW);
    const skipped = await bootstrapHumanReviewForCandidate(verification.candidate, { reviewRepo, now: () => NOW });
    expect(skipped.outcome).toBe("skipped");
    const included = await bootstrapHumanReviewForCandidate(verification.candidate, {
      reviewRepo,
      now: () => NOW,
      includeVerification: true,
    });
    expect(included.outcome).toBe("created");
  });

  it("pipeline bootstrap creates review metadata on successful run", async () => {
    const candidateRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepoLocal = createInMemoryHumanMarketingReviewRepository();
    const { createInMemoryContentAssignmentStore } = await import(
      "@/lib/marketing/content/store/contentAssignmentStore"
    );
    const { createInMemoryGovernanceReviewStore } = await import(
      "@/lib/marketing/content/governance/store/governanceReviewStore"
    );
    const { buildResearchContext, managerSelectJson } = await import("@/lib/marketing/cron/daily/__tests__/fixtures");

    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo: candidateRepo,
        reviewRepo: reviewRepoLocal,
        now: NOW,
        contentAssignmentStore: createInMemoryContentAssignmentStore(),
        governanceReviewStore: createInMemoryGovernanceReviewStore(),
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () => managerSelectJson(),
        requestDraft: async () => ({ ...draft, assignmentId: null }),
        requestGovernance: async () => allow(),
        requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
      },
    );

    expect(result.candidate?.status).toBe("ready_for_human_review");
    const review = await reviewRepoLocal.findByCandidateId(result.candidate!.candidateId);
    expect(review?.status).toBe("pending");
    expect(result.run.metadata.humanReviewBootstrap).toMatchObject({ status: "succeeded", outcome: "created" });
  });
});
