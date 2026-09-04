vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import {
  buildDailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import {
  processMarketingProductionQueue,
} from "@/lib/marketing/cron/daily/agendaSlate/processMarketingProductionQueue";
import {
  DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  buildQueuedProductionRequest,
  createInMemoryMarketingProductionRequestRepository,
  ownershipFromClaim,
  resetDefaultMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  createInMemoryHumanMarketingReviewRepository,
  resetDefaultHumanMarketingReviewRepository,
} from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { bootstrapHumanReviewForCandidate } from "@/lib/marketing/review/bootstrap/bootstrapHumanReview";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { DailyMarketingPipelineResult } from "@/lib/marketing/cron/daily/types";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";

const DAY = "2026-09-05";

const groundedDraft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance changed for autumn travelers.",
  channel: "threads",
  agenda: "Japan autumn travel update",
  sourceReferences: ["evidence:ev-official"],
};

function multiCandidateContext(count = 6) {
  const agendaCandidates: CompactManagerAgendaCandidate[] = Array.from({ length: count }, (_, i) => ({
    ...agendaCandidate,
    agendaCandidateId: `ac-item-${i + 1}`,
    researchBriefId: `rb-item-${i + 1}`,
    title: `Travel topic ${i + 1}`,
    summary: `Summary for topic ${i + 1} with enough detail.`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-item-${i + 1}`,
        url: `https://example.com/articles/topic-${i + 1}`,
        excerpt: `Summary for topic ${i + 1} with enough detail.`,
      },
    ],
  }));
  return buildResearchContext({
    agendaCandidates,
    briefs: agendaCandidates.map((c) => ({
      ...researchBrief,
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
    })),
  });
}

function makeSlate(count = 6) {
  return buildDailyAgendaSlate({
    research: multiCandidateContext(count),
    logicalRunKey: `daily-marketing-plan:${DAY}`,
    businessDateKst: DAY,
    runId: "run-slate",
    correlationId: "corr-slate",
    now: NOW,
  });
}

async function buildEligibleCandidate(input: {
  logicalRunKey: string;
  candidateId: string;
  title?: string;
}): Promise<CompletedMarketingCandidate> {
  const handoff = prepareManagerToContentHandoff(
    {
      title: input.title ?? "Japan autumn travel update",
      summary: "Official guidance changed for autumn travelers.",
      agendaCandidateId: "ac-japan-autumn",
      researchBriefId: "rb-japan-autumn",
      evidenceRefs: [
        {
          evidenceId: "ev-official",
          sourceId: "src-official",
          sourceType: "official_government",
          sourceName: "JNTO",
          isOfficial: true,
          evidenceType: "official_statement",
          url: "https://example.com/official",
          reference: null,
          excerpt: "Japan autumn travel guidance updated.",
          publishedAt: "2026-09-01T00:00:00.000Z",
          observedAt: NOW.toISOString(),
          credibilityHint: 0.85,
        },
      ],
      idempotencyKey: input.logicalRunKey,
      now: NOW,
    },
    { store: createInMemoryContentAssignmentStore(), now: NOW },
  );

  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: input.candidateId,
    runId: "run-prod",
    logicalRunKey: input.logicalRunKey,
    businessDateKst: DAY,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: handoff.contentPlanScaffold,
    draft: groundedDraft,
    governanceDecision: null,
    status: "ready_for_human_review",
    revisionHistory: [],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: "corr",
      researchStatus: "ok",
      governanceReviewId: null,
    },
    observability: {
      runId: "run-prod",
      logicalRunKey: input.logicalRunKey,
      businessDateKst: DAY,
      correlationId: "corr",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: 0,
      governanceDecision: null,
      finalCandidateId: input.candidateId,
      finalStatus: "ready_for_human_review",
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      failureReason: null,
    },
  };
}

function successResult(
  candidate: CompletedMarketingCandidate,
  idempotent = false,
): DailyMarketingPipelineResult {
  return {
    idempotent,
    candidate,
    run: {
      contract: "daily-marketing-run-v1",
      runId: candidate.runId,
      logicalRunKey: candidate.logicalRunKey,
      businessDateKst: DAY,
      routineId: "daily-marketing-plan",
      correlationId: "corr",
      executionAttempt: 1,
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      status: idempotent ? "skipped_idempotent" : "completed",
      researchStatus: "ok",
      selectedAgendaId: candidate.selectedAgenda.id,
      assignmentId: candidate.contentAssignment.assignmentId,
      governanceReviewId: null,
      completedCandidateId: candidate.candidateId,
      failureReason: null,
      degraded: false,
      observability: candidate.observability,
      metadata: {},
    },
  };
}

describe("STEP G-7 crash/recovery audit", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultMarketingProductionRequestRepository();
    resetDefaultHumanMarketingReviewRepository();
  });

  it("A: no candidate -> production -> candidate + HMR -> COMPLETED", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const slate = makeSlate();
    const queued = buildQueuedProductionRequest({
      slate,
      candidate: slate.candidates[0]!,
      now: NOW,
      productId: PRODUCT,
    });
    await productionRequestRepo.enqueue(queued);

    let aiCalls = 0;
    const result = await processMarketingProductionQueue({
      maxBatch: 1,
      workerId: "w-a",
      now: NOW,
      deps: {
        productionRequestRepo,
        runRepo,
        reviewRepo,
        executeProduction: async (request) => {
          aiCalls += 1;
          const candidate = await buildEligibleCandidate({
            logicalRunKey: request.logicalRunKey,
            candidateId: "cmc_normal",
            title: request.selection.title,
          });
          await runRepo.saveCandidate(candidate);
          await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });
          return successResult(candidate);
        },
      },
    });

    expect(aiCalls).toBe(1);
    expect(result.processed[0]?.outcome).toBe("completed");
    expect(await reviewRepo.findByCandidateId("cmc_normal")).toBeTruthy();
    expect((await productionRequestRepo.findByLogicalKey(queued.logicalRunKey))?.status).toBe(
      "COMPLETED",
    );
  });

  it("B: candidate + HMR exist -> no AI -> COMPLETED", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const slate = makeSlate();
    const queued = buildQueuedProductionRequest({
      slate,
      candidate: slate.candidates[0]!,
      now: NOW,
    });
    await productionRequestRepo.enqueue(queued);
    const candidate = await buildEligibleCandidate({
      logicalRunKey: queued.logicalRunKey,
      candidateId: "cmc_both",
    });
    await runRepo.saveCandidate(candidate);
    await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => NOW });

    let aiCalls = 0;
    const result = await processMarketingProductionQueue({
      maxBatch: 1,
      workerId: "w-b",
      now: NOW,
      deps: {
        productionRequestRepo,
        runRepo,
        reviewRepo,
        executeProduction: async () => {
          aiCalls += 1;
          throw new Error("must not AI");
        },
      },
    });
    expect(aiCalls).toBe(0);
    expect(result.processed[0]?.outcome).toBe("completed");
    expect(result.processed[0]?.idempotent).toBe(true);
    expect(result.processed[0]?.humanReviewRecovered).toBe(false);
  });

  it("C: candidate exists + HMR missing -> no AI -> HMR recovered -> COMPLETED", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const slate = makeSlate();
    const queued = buildQueuedProductionRequest({
      slate,
      candidate: slate.candidates[0]!,
      now: NOW,
    });
    await productionRequestRepo.enqueue(queued);
    const candidate = await buildEligibleCandidate({
      logicalRunKey: queued.logicalRunKey,
      candidateId: "cmc_missing_hmr",
    });
    await runRepo.saveCandidate(candidate);
    expect(await reviewRepo.findByCandidateId("cmc_missing_hmr")).toBeNull();

    let aiCalls = 0;
    const result = await processMarketingProductionQueue({
      maxBatch: 1,
      workerId: "w-c",
      now: NOW,
      deps: {
        productionRequestRepo,
        runRepo,
        reviewRepo,
        executeProduction: async () => {
          aiCalls += 1;
          throw new Error("must not AI");
        },
      },
    });
    expect(aiCalls).toBe(0);
    expect(result.processed[0]?.outcome).toBe("completed");
    expect(result.processed[0]?.humanReviewRecovered).toBe(true);
    expect(await reviewRepo.findByCandidateId("cmc_missing_hmr")).toBeTruthy();
    expect((await productionRequestRepo.findByLogicalKey(queued.logicalRunKey))?.status).toBe(
      "COMPLETED",
    );
  });

  it("D: HMR recovery fails -> must not COMPLETED", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const base = createInMemoryHumanMarketingReviewRepository();
    const reviewRepo = {
      ...base,
      async findByCandidateId(id: string) {
        return base.findByCandidateId(id);
      },
      async save() {
        throw new Error("hmr_persist_boom");
      },
      async listReviews(opts?: { limit?: number }) {
        return base.listReviews(opts);
      },
      async update() {
        throw new Error("no");
      },
    };
    const slate = makeSlate();
    const queued = buildQueuedProductionRequest({
      slate,
      candidate: slate.candidates[0]!,
      now: NOW,
    });
    await productionRequestRepo.enqueue(queued);
    const candidate = await buildEligibleCandidate({
      logicalRunKey: queued.logicalRunKey,
      candidateId: "cmc_hmr_fail",
    });
    await runRepo.saveCandidate(candidate);

    const result = await processMarketingProductionQueue({
      maxBatch: 1,
      workerId: "w-d",
      now: NOW,
      deps: {
        productionRequestRepo,
        runRepo,
        reviewRepo,
        executeProduction: async () => {
          throw new Error("must not AI");
        },
      },
    });
    expect(result.processed[0]?.outcome).toBe("failed");
    expect((await productionRequestRepo.findByLogicalKey(queued.logicalRunKey))?.status).toBe(
      "FAILED",
    );
    expect(await reviewRepo.findByCandidateId("cmc_hmr_fail")).toBeNull();
  });

  it("stale ownership: late worker A cannot overwrite worker B", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const slate = makeSlate();
    const queued = buildQueuedProductionRequest({
      slate,
      candidate: slate.candidates[0]!,
      now: NOW,
    });
    await productionRequestRepo.enqueue(queued);

    const claimA = await productionRequestRepo.claimNext({ workerId: "worker-a", now: NOW });
    expect(claimA?.claimToken).toBeTruthy();
    const ownershipA = ownershipFromClaim(claimA!);

    const staleNow = new Date(NOW.getTime() + DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS + 1);
    const claimB = await productionRequestRepo.claimNext({
      workerId: "worker-b",
      now: staleNow,
      staleAfterMs: DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
    });
    expect(claimB?.workerId).toBe("worker-b");
    expect(claimB?.attemptCount).toBe(2);
    expect(claimB?.claimToken).not.toBe(claimA?.claimToken);

    const candidate = await buildEligibleCandidate({
      logicalRunKey: queued.logicalRunKey,
      candidateId: "cmc_owner",
    });
    await runRepo.saveCandidate(candidate);
    await bootstrapHumanReviewForCandidate(candidate, { reviewRepo, now: () => staleNow });

    const lateA = await productionRequestRepo.markCompleted({
      logicalRunKey: queued.logicalRunKey,
      completedCandidateId: "cmc_owner",
      ownership: ownershipA,
      now: staleNow,
    });
    expect(lateA.ok).toBe(false);
    if (!lateA.ok) expect(lateA.reason).toBe("ownership_lost");
    expect((await productionRequestRepo.findByLogicalKey(queued.logicalRunKey))?.status).toBe(
      "RUNNING",
    );

    const okB = await productionRequestRepo.markCompleted({
      logicalRunKey: queued.logicalRunKey,
      completedCandidateId: "cmc_owner",
      ownership: ownershipFromClaim(claimB!),
      now: staleNow,
    });
    expect(okB.ok).toBe(true);
    expect(okB.ok && okB.request.status).toBe("COMPLETED");
  });

  it("fresh RUNNING is not reclaimed; batch/terminal/dry-run still hold", async () => {
    const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const slate = makeSlate();
    for (const candidate of slate.candidates.slice(0, 2)) {
      await productionRequestRepo.enqueue(
        buildQueuedProductionRequest({ slate, candidate, now: NOW }),
      );
    }
    const first = await productionRequestRepo.claimNext({ workerId: "w1", now: NOW });
    expect(
      await productionRequestRepo.claimNext({
        workerId: "w2",
        now: new Date(NOW.getTime() + 60_000),
      }),
    ).not.toBeNull(); // second QUEUED item
    // first remains owned by w1 — not reclaimable while fresh
    expect(first?.status).toBe("RUNNING");

    const dry = await processMarketingProductionQueue({
      dryRun: true,
      maxBatch: 3,
      workerId: "dry",
      now: NOW,
      deps: {
        productionRequestRepo,
        runRepo,
        reviewRepo,
        executeProduction: async () => {
          throw new Error("no");
        },
      },
    });
    expect(dry.processed.every((p) => p.outcome === "would_claim")).toBe(true);
  });
});
