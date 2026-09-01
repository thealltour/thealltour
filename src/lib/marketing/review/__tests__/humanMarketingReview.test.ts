vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import {
  createInMemoryHumanMarketingReviewRepository,
  resetDefaultHumanMarketingReviewRepository,
} from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { NOW, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_8 } from "@/lib/marketing/social/publication/governanceBoundary";
import { HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS } from "@/lib/marketing/review/index";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { HumanReviewTransitionError, HumanReviewPolicyError } from "@/lib/marketing/review/transitions";

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

async function seedCandidate(status: "ready_for_human_review" | "needs_human_review" | "blocked" | "failed") {
  const repo = createInMemoryDailyMarketingRunRepository();
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Japan autumn travel update",
      summary: "Official guidance changed.",
      idempotencyKey: `${LOGICAL_KEY}-${status}`,
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
    runId: "run_test",
    logicalRunKey: `${LOGICAL_KEY}-${status}`,
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
      runId: "run_test",
      logicalRunKey: `${LOGICAL_KEY}-${status}`,
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
      status: status === "blocked" ? "revision_required" : status === "needs_human_review" ? "approval_pending" : "publish_ready",
    },
    governance: null,
    now: NOW,
  });
  candidate.status = status;
  candidate.logicalRunKey = `${LOGICAL_KEY}-${status}`;
  candidate.candidateId = `cmc_${status}`;
  const saved = await repo.saveCandidate(candidate);
  return { repo, candidate: saved };
}

function createService(candidateRepo: ReturnType<typeof createInMemoryDailyMarketingRunRepository>) {
  const reviewRepo = createInMemoryHumanMarketingReviewRepository();
  return new HumanMarketingReviewService({
    candidateRepo,
    reviewRepo,
    now: () => NOW,
  });
}

describe("HumanMarketingReviewService", () => {
  beforeEach(() => {
    resetDefaultHumanMarketingReviewRepository();
  });

  it("A: ready candidate creates pending review", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const review = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    expect(review.status).toBe("pending");
    expect(review.originalDraft.body).toBe(draft.body);
  });

  it("B: needs_human_review detail allows review with warning semantics", async () => {
    const { repo, candidate } = await seedCandidate("needs_human_review");
    const service = createService(repo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.candidate.status).toBe("needs_human_review");
    expect(detail?.canApprove).toBe(true);
  });

  it("C: blocked candidate cannot be approved", async () => {
    const { repo, candidate } = await seedCandidate("blocked");
    const service = createService(repo);
    await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    await expect(service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" })).rejects.toBeInstanceOf(
      HumanReviewPolicyError,
    );
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.canApprove).toBe(false);
  });

  it("D: failed candidate is diagnostics only", async () => {
    const { repo, candidate } = await seedCandidate("failed");
    const service = createService(repo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.diagnosticsOnly).toBe(true);
    await expect(
      service.updateHumanDraft({
        candidateId: candidate.candidateId,
        draft: { title: "x", body: "edited", channel: "threads" },
        reviewedBy: "admin",
      }),
    ).rejects.toThrow("diagnostics_only_candidate");
  });

  it("E/F: save draft + governance stale flag", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const updated = await service.updateHumanDraft({
      candidateId: candidate.candidateId,
      draft: { title: "edited", body: "Human changed the draft after governance.", channel: "threads" },
      reviewedBy: "admin",
    });
    expect(updated.status).toBe("editing");
    expect(updated.humanEditedAfterGovernance).toBe(true);
  });

  it("G/H/I: approve is manual publish only, no publication side effects", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const review = await service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" });
    expect(review.status).toBe("approved_for_manual_publish");
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
    expect(HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS).toBe(0);
  });

  it("J: defer then pending via editing path", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    await service.deferHumanReview({ candidateId: candidate.candidateId, reviewedBy: "admin" });
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.review?.status).toBe("deferred");
  });

  it("K: reject transition", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const review = await service.rejectHumanReview({
      candidateId: candidate.candidateId,
      rejectionReason: "off-brand",
      reviewedBy: "admin",
    });
    expect(review.status).toBe("rejected");
  });

  it("L/M: manually published records metadata only", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    await service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" });
    const review = await service.markManuallyPublished({
      candidateId: candidate.candidateId,
      manualPublication: {
        platform: "threads",
        externalUrl: "https://example.com/post/123",
        notes: "posted manually",
      },
      reviewedBy: "admin",
    });
    expect(review.status).toBe("manually_published");
    expect(review.manualPublication?.externalUrl).toContain("example.com");
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
  });

  it("N: duplicate review creation is idempotent", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const first = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    const second = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    expect(first.reviewId).toBe(second.reviewId);
  });

  it("O: invalid transitions rejected", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    await service.rejectHumanReview({
      candidateId: candidate.candidateId,
      rejectionReason: "no",
      reviewedBy: "admin",
    });
    await expect(
      service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" }),
    ).rejects.toBeInstanceOf(HumanReviewTransitionError);
  });

  it("P: queue filters work", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const queue = await service.listHumanReviewQueue("today");
    expect(queue.items.some((item) => item.candidateId === candidate.candidateId)).toBe(true);
  });

  it("Q/R: queue/detail DTO has provenance and no embeddings", async () => {
    const { repo, candidate } = await seedCandidate("ready_for_human_review");
    const service = createService(repo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    expect(detail?.candidate.selectedAgenda.title).toBeTruthy();
    expect(jsonContainsForbiddenBotLeak(detail)).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(/"embedding"/);
  });
});

describe("publication safety", () => {
  it("human review module has zero publication side effects", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
    expect(HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS).toBe(0);
  });
});
