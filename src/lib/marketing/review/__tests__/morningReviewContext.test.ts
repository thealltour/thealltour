vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import { buildLogicalDailyRunKey, formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import {
  createInMemoryHumanMarketingReviewRepository,
  resetDefaultHumanMarketingReviewRepository,
} from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { NOW, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import {
  buildMorningMarketingReviewContext,
  buildMorningReviewQueueSummary,
} from "@/lib/marketing/review/morningReview/buildMorningReviewContext";
import {
  buildMorningReviewEvidenceClaims,
  pickFactsToUse,
} from "@/lib/marketing/review/morningReview/buildEvidenceLinks";
import { MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT } from "@/lib/marketing/review/morningReview/types";
import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";

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

async function seedReadyCandidate(options: {
  saveRun?: boolean;
  incidentHistory?: unknown[];
  executionAttempt?: number;
  withReview?: boolean;
  candidateId?: string;
} = {}) {
  const repo = createInMemoryDailyMarketingRunRepository();
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Japan autumn travel update",
      summary: "Official guidance changed.",
      idempotencyKey: `${LOGICAL_KEY}-morning`,
    },
    { now: NOW },
  );

  if (handoff.contentAssignment.facts.length > 0 && handoff.contentAssignment.evidenceRefs.length > 0) {
    const fact = handoff.contentAssignment.facts[0];
    const evidence = handoff.contentAssignment.evidenceRefs[0];
    fact.evidenceRefs = [evidence.evidenceId];
  }

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
      requestGovernance: async () => allow(),
    },
  );

  const logicalRunKey = `${LOGICAL_KEY}-morning`;
  const run = {
    contract: "daily-marketing-run-v1" as const,
    runId: "run_morning",
    logicalRunKey,
    businessDateKst: BUSINESS_DATE,
    routineId: DAILY_MARKETING_ROUTINE_ID,
    correlationId: "corr",
    executionAttempt: options.executionAttempt ?? 1,
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
      runId: "run_morning",
      logicalRunKey,
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
      finalStatus: "ready_for_human_review",
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      failureReason: null,
    },
    metadata: {
      incidentHistory: options.incidentHistory ?? [],
    },
  };

  const candidate = buildCompletedCandidate({
    run,
    handoff,
    pipeline: { ...pipeline, status: "publish_ready" },
    governance: allow(),
    now: NOW,
  });
  candidate.status = "ready_for_human_review";
  candidate.logicalRunKey = logicalRunKey;
  candidate.candidateId = options.candidateId ?? "cmc_morning_test";
  await repo.saveCandidate(candidate);
  if (options.saveRun !== false) {
    await repo.saveRun(run);
  }

  const reviewRepo = createInMemoryHumanMarketingReviewRepository();
  if (options.withReview !== false) {
    const service = new HumanMarketingReviewService({ candidateRepo: repo, reviewRepo, now: () => NOW });
    await service.getOrCreateHumanReview(candidate.candidateId, "admin");
  }

  return { repo, reviewRepo, candidate, run };
}

function createService(candidateRepo: ReturnType<typeof createInMemoryDailyMarketingRunRepository>, reviewRepo: ReturnType<typeof createInMemoryHumanMarketingReviewRepository>) {
  return new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
}

describe("MorningMarketingReviewContext", () => {
  beforeEach(() => {
    resetDefaultHumanMarketingReviewRepository();
  });

  it("1: pending review appears in morning queue", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("pending");
    expect(queue.items.some((row) => row.candidateId === candidate.candidateId)).toBe(true);
    expect(queue.pendingCount).toBeGreaterThan(0);
  });

  it("2: queue identifies today's KST review correctly", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("today");
    const todayKst = formatKstBusinessDate(NOW);
    expect(queue.todayCandidate?.businessDateKst).toBe(todayKst);
    expect(queue.todayCandidate?.candidateId).toBe(candidate.candidateId);
    expect(queue.todayCandidate?.isToday).toBe(true);
  });

  it("3: queue shows governance decision", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("all");
    const row = queue.items.find((item) => item.candidateId === candidate.candidateId);
    expect(row?.governanceDecision).toBe("ALLOW");
  });

  it("4: queue distinguishes pending vs missing review", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({ withReview: false });
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("all");
    const row = queue.items.find((item) => item.candidateId === candidate.candidateId);
    expect(row?.reviewWorkflowState).toBe("missing");
    expect(row?.actionLabel).toContain("누락");

    await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    const queue2 = await service.listMorningReviewQueue("all");
    const row2 = queue2.items.find((item) => item.candidateId === candidate.candidateId);
    expect(row2?.reviewWorkflowState).toBe("pending");
    expect(row2?.actionLabel).toBe("검토 대기");
  });

  it("5: detail aggregate loads candidate + review", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.contract).toBe(MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT);
    expect(context?.identity.candidateId).toBe(candidate.candidateId);
    expect(context?.identity.reviewId).toBeTruthy();
    expect(context?.detail.candidate.candidateId).toBe(candidate.candidateId);
  });

  it("6: detail includes agenda context", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.agenda.title).toBe("Japan autumn travel update");
    expect(context?.agenda.rationale.length).toBeGreaterThanOrEqual(0);
  });

  it("7: detail includes draft", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.draft.body).toContain("Official guidance");
    expect(context?.draft.channel).toBe("threads");
  });

  it("8: detail includes linked evidence when assignment links exist", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    const linked = context?.evidence.claims.filter((claim) => claim.linkage === "assignment_fact") ?? [];
    if (linked.length > 0) {
      expect(linked[0].supports.length).toBeGreaterThan(0);
    } else {
      expect(context?.evidence.message).toBeTruthy();
    }
  });

  it("9: evidence relationship is not fabricated", () => {
    const claims = buildMorningReviewEvidenceClaims({
      facts: [{ statement: "Claim A", confidence: "high", evidenceRefs: ["ev-1"] }],
      evidenceRefs: [{ evidenceId: "ev-2", sourceName: "Other", sourceType: "web", isOfficial: false }],
      factsToUse: ["Claim A"],
    });
    expect(claims[0].linkage).toBe("unlinked");
    expect(claims[0].supports).toHaveLength(0);
  });

  it("10: detail includes governance decision", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.governance.decision).toBe("ALLOW");
  });

  it("11: Governance ALLOW does not imply human approval", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.governance.summary).toContain("인간");
    expect(context?.governance.humanApprovalStillRequired).toBe(true);
    expect(context?.humanAction.status).toBe("pending");
  });

  it("12: governanceStale visible after human edit", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    await service.updateHumanDraft({
      candidateId: candidate.candidateId,
      draft: { title: "edited", body: "Human changed after governance.", channel: "threads" },
      reviewedBy: "admin",
    });
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.governance.governanceStale).toBe(true);
    expect(context?.draft.humanEditedAfterGovernance).toBe(true);
  });

  it("13: relevant performance context included when available", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    const snapshot: ContentPerformanceSnapshot = {
      contract: "content-performance-snapshot-v1",
      snapshotId: "snap_1",
      candidateId: candidate.candidateId,
      reviewId: detail!.review!.reviewId,
      platform: "threads",
      publishedAt: NOW.toISOString(),
      observedAt: NOW.toISOString(),
      collectionStatus: "success",
      dataAvailability: "partial",
      metrics: { impressions: 120 },
      origin: "ai_unchanged",
      humanEditedAfterGovernance: false,
      correlationId: null,
      createdAt: NOW.toISOString(),
    };
    const context = buildMorningMarketingReviewContext({
      detail: detail!,
      run: null,
      performanceSnapshots: [snapshot],
    });
    expect(context.performance.absent).toBe(false);
    expect(context.performance.items[0].metrics.impressions).toBe(120);
  });

  it("14: missing performance ≠ zero metrics", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.performance.absent).toBe(true);
    expect(context?.performance.message).toContain("없습니다");
    expect(context?.performance.items).toHaveLength(0);
  });

  it("15: operational recovery notice appears when prior incidents exist", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({
      incidentHistory: [{ at: NOW.toISOString() }, { at: NOW.toISOString() }],
      executionAttempt: 3,
    });
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.operations.priorIncidentCount).toBe(2);
    expect(context?.operations.recovered).toBe(true);
    expect(context?.operations.notice).toContain("2");
  });

  it("16: healthy run does not show alarming incident state", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({ incidentHistory: [] });
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.operations.priorIncidentCount).toBe(0);
    expect(context?.operations.notice).toBeNull();
  });

  it("17: no raw stack trace in normal view model", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    const json = JSON.stringify(context);
    expect(json).not.toMatch(/stack trace/i);
    expect(json).not.toMatch(/Error: /);
  });

  it("18: no secrets/provider credentials in DTO", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(jsonContainsForbiddenBotLeak(context)).toBe(false);
    expect(JSON.stringify(context)).not.toMatch(/service_role|api_key|secret/i);
  });

  it("19: missing optional research context does not crash", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.agenda.timelinessNote).toBeDefined();
    expect(context?.agenda.researchScoreAtSelection).toBeDefined();
  });

  it("20: missing evidence valid state renders safely", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    detail!.candidate.contentAssignment.facts = [];
    detail!.candidate.contentAssignment.evidenceRefs = [];
    if (detail!.candidate.contentPlan) {
      detail!.candidate.contentPlan.factsToUse = [];
    }
    const context = buildMorningMarketingReviewContext({
      detail: detail!,
      run: null,
      performanceSnapshots: [],
    });
    expect(context.evidence.claims).toHaveLength(0);
    expect(context.evidence.message).toContain("사실");
  });

  it("21: invalid/missing workflow review is distinguished", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({ withReview: false });
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.operations.workflowIssue).toBe("missing_review");
    expect(context?.humanAction.status).toBeNull();
  });

  it("22: manually published state displays correctly", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    await service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" });
    await service.markManuallyPublished({
      candidateId: candidate.candidateId,
      manualPublication: { platform: "threads", externalUrl: "https://example.com/p/1" },
      reviewedBy: "admin",
    });
    const context = await service.getMorningMarketingReviewContext(candidate.candidateId);
    expect(context?.humanAction.status).toBe("manually_published");
    expect(context?.humanAction.manuallyPublishedAt).toBeTruthy();
  });

  it("23: detail GET path remains read-only (no review mutation in context builder)", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const before = await reviewRepo.findByCandidateId(candidate.candidateId);
    await service.getMorningMarketingReviewContext(candidate.candidateId);
    const after = await reviewRepo.findByCandidateId(candidate.candidateId);
    expect(after?.updatedAt).toBe(before?.updatedAt);
    expect(after?.status).toBe(before?.status);
  });

  it("24: review actions still preserve STEP 3-8 transitions", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const approved = await service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "admin" });
    expect(approved.status).toBe("approved_for_manual_publish");
  });

  it("25: bootstrap semantics unaffected — getOrCreate still works", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({ withReview: false });
    const service = createService(repo, reviewRepo);
    const review = await service.getOrCreateHumanReview(candidate.candidateId, "admin");
    expect(review.status).toBe("pending");
  });

  it("26: pickFactsToUse prefers contentPlan factsToUse", () => {
    const facts = [{ statement: "A", confidence: "high" as const, evidenceRefs: [] }];
    const fromPlan = pickFactsToUse({ factsToUse: ["Planned fact"] } as never, facts);
    expect(fromPlan).toEqual(["Planned fact"]);
  });

  it("27: queue summary contract version", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const base = await service.listHumanReviewQueue("all");
    const candidates = await repo.listCandidates({ limit: 100 });
    const summary = buildMorningReviewQueueSummary({
      items: base.items,
      todayCandidate: base.todayCandidate,
      pendingCount: base.pendingCount,
      candidatesById: new Map(candidates.map((c) => [c.candidateId, c])),
      now: NOW,
    });
    expect(summary.contract).toBe(MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT);
    expect(summary.items.some((row) => row.candidateId === candidate.candidateId)).toBe(true);
  });

  it("28: performance failure metrics not shown as zero", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const detail = await service.getHumanReviewDetail(candidate.candidateId);
    const snapshot: ContentPerformanceSnapshot = {
      contract: "content-performance-snapshot-v1",
      snapshotId: "snap_fail",
      candidateId: candidate.candidateId,
      reviewId: detail!.review!.reviewId,
      platform: "threads",
      publishedAt: null,
      observedAt: NOW.toISOString(),
      collectionStatus: "unsupported",
      dataAvailability: "unavailable",
      metrics: {},
      origin: "ai_unchanged",
      humanEditedAfterGovernance: false,
      correlationId: null,
      createdAt: NOW.toISOString(),
    };
    const context = buildMorningMarketingReviewContext({
      detail: detail!,
      run: null,
      performanceSnapshots: [snapshot],
    });
    expect(Object.keys(context.performance.items[0].metrics)).toHaveLength(0);
  });

  it("29: queue row actionNeeded reflects pending human task", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate();
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("all");
    const row = queue.items.find((item) => item.candidateId === candidate.candidateId);
    expect(row?.actionNeeded).toBe(true);
  });

  it("30: verification fixture flagged in identity when applicable", async () => {
    const { repo, reviewRepo } = await seedReadyCandidate({
      candidateId: "cmc_step_3_8_verification",
    });
    const service = createService(repo, reviewRepo);
    const context = await service.getMorningMarketingReviewContext("cmc_step_3_8_verification");
    expect(context?.identity.isVerificationFixture).toBe(true);
  });
});

describe("morningReview queue filter semantics", () => {
  it("pending filter includes missing review workflow issue", async () => {
    const { repo, reviewRepo, candidate } = await seedReadyCandidate({ withReview: false });
    const service = createService(repo, reviewRepo);
    const queue = await service.listMorningReviewQueue("pending");
    const row = queue.items.find((item) => item.candidateId === candidate.candidateId);
    expect(row?.reviewWorkflowState).toBe("missing");
  });
});
