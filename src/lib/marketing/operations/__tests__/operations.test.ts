vi.mock("server-only", () => ({}));

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { buildVerificationArtifacts } from "@/lib/marketing/review/verification/buildVerificationCandidate";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import {
  buildLogicalDailyRunKey,
  formatKstBusinessDate,
} from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  DAILY_MARKETING_ROUTINE_ID,
  DAILY_MARKETING_RUN_CONTRACT,
} from "@/lib/marketing/cron/daily/types";
import {
  getDailyMarketingOperationsStatus,
  isVerificationRecord,
  sanitizeOperationsDtoForResponse,
} from "@/lib/marketing/operations";
import {
  classifyOverallStatus,
  buildActionRequiredReasons,
} from "@/lib/marketing/operations/healthRules";
import {
  PUBLICATION_FLOW_INACTIVE,
  PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9,
  SNS_SIDE_EFFECTS_STEP_3_8,
  OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10,
} from "@/lib/marketing/social/publication/governanceBoundary";
import {
  PERFORMANCE_BRIEF_ARTIFACT_VERSION,
  PERFORMANCE_BRIEF_TIMEZONE,
} from "@/lib/marketing/cron/performanceBriefArtifact";
import { enrichPerformanceBriefWithManualSnapshots } from "@/lib/marketing/performance/integration/enrichPerformanceBrief";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingPipeline";
import {
  buildResearchContext,
  managerSelectJson,
  NOW,
  PRODUCT,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { createInitialHumanReview } from "@/lib/marketing/review/dto";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { mapResearchSignalRow } from "@/lib/marketing/research/repository/mappers";

const BUSINESS_DATE = "2026-09-02";
const NOW_AFTER_RUN = new Date("2026-09-02T01:00:00.000Z");

function buildProductionRunAndCandidate(businessDateKst: string) {
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst,
  });
  const { run, candidate } = buildVerificationArtifacts(NOW_AFTER_RUN);
  return {
    run: {
      ...run,
      contract: DAILY_MARKETING_RUN_CONTRACT,
      logicalRunKey,
      businessDateKst,
      routineId: DAILY_MARKETING_ROUTINE_ID,
      runId: `run_${businessDateKst}`,
      metadata: { productId: PRODUCT },
    },
    candidate: {
      ...candidate,
      logicalRunKey,
      businessDateKst,
      candidateId: `cmc_${logicalRunKey.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)}`,
      provenance: {
        ...candidate.provenance,
        routineId: DAILY_MARKETING_ROUTINE_ID,
      },
    },
  };
}

function writeBriefArtifact(dir: string, generatedAt: string) {
  const path = join(dir, "latest-performance-brief.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        version: PERFORMANCE_BRIEF_ARTIFACT_VERSION,
        generatedAt,
        timezone: PERFORMANCE_BRIEF_TIMEZONE,
        period: { start: "2026-09-01T00:00:00.000+09:00", end: "2026-09-01T23:59:59.999+09:00" },
        productId: null,
        channel: "threads",
        sourcesChecked: ["analytics_events"],
        availableChannels: ["threads"],
        confirmedMetrics: [],
        missingItems: [],
        notableChanges: [],
        managerEvidence: [],
        dataAvailability: "unavailable",
        snsDirectCollection: false,
      },
      null,
      2,
    ),
  );
  return path;
}

const BEFORE_NINE_KST = new Date("2026-09-01T23:45:00.000Z");

describe("STEP 3-10 marketing operations", () => {
  let briefDir: string;
  let briefPath: string;

  beforeEach(() => {
    briefDir = join(tmpdir(), `ops-brief-${Date.now()}`);
    mkdirSync(briefDir, { recursive: true });
    briefPath = writeBriefArtifact(briefDir, "2026-09-02T00:30:00.000+09:00");
  });

  afterEach(() => {
    rmSync(briefDir, { recursive: true, force: true });
  });

  it("A: healthy daily cycle classification", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: candidate.candidateId });
    await runRepo.saveCandidate(candidate);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: BEFORE_NINE_KST },
      {
        runRepo,
        reviewRepo,
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.marketingRun.status).toBe("healthy");
    expect(status.candidate.candidateId).toBeTruthy();
    expect(["action_required", "degraded", "healthy"]).toContain(status.overallStatus);
  });

  it("B: research degraded but cycle valid", async () => {
    const beforeNineKst = new Date("2026-09-01T23:45:00.000Z");
    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: beforeNineKst },
      {
        runRepo: createInMemoryDailyMarketingRunRepository(),
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => false,
      },
    );
    expect(status.research.status).toBe("degraded");
    expect(status.research.degradedSources).toContain("bge_m3");
  });

  it("C: performance feedback absent is degraded not failed", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: candidate.candidateId });
    await runRepo.saveCandidate(candidate);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: BEFORE_NINE_KST },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.feedback.performanceSignalsAvailable).toBe(false);
    expect(status.overallStatus).not.toBe("failed");
  });

  it("D: failed marketing run is failed overall", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const { run } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({
      ...run,
      status: "failed",
      failureReason: "RUNTIME_PROVIDER_FAILED",
      completedCandidateId: null,
    });

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: NOW_AFTER_RUN },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.marketingRun.status).toBe("failed");
    expect(status.overallStatus).toBe("failed");
    expect(status.marketingRun.message).toContain("RUNTIME_PROVIDER_FAILED");
  });

  it("E: completed run with missing candidate detected", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: candidate.candidateId });

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: NOW_AFTER_RUN },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.overallStatus).toBe("failed");
    expect(status.candidate.message).toContain("no production candidate");
  });

  it("F: duplicate production candidate detected", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const first = buildProductionRunAndCandidate(BUSINESS_DATE);
    const second = buildProductionRunAndCandidate(BUSINESS_DATE);
    second.candidate.logicalRunKey = `${first.candidate.logicalRunKey}:duplicate`;
    second.candidate.candidateId = `${first.candidate.candidateId}_dup`;
    await runRepo.saveCandidate(first.candidate);
    await runRepo.saveCandidate(second.candidate);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: BEFORE_NINE_KST },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.candidate.duplicateCount).toBe(1);
    expect(status.overallStatus).toBe("failed");
  });

  it("G: candidate needs review is action_required", () => {
    const { candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    const reasons = buildActionRequiredReasons({
      candidate: { ...candidate, status: "needs_human_review" },
      review: null,
    });
    expect(reasons.some((reason) => reason.includes("Governance returned REVIEW"))).toBe(true);
    expect(
      classifyOverallStatus({
        researchStatus: "healthy",
        performanceBriefStatus: "healthy",
        marketingRunStatus: "healthy",
        candidateStatus: "healthy",
        humanReviewStatus: "action_required",
        run: null,
        candidate: { ...candidate, status: "needs_human_review" },
        review: null,
        duplicateProductionCandidates: 0,
        actionRequiredReasons: reasons,
      }),
    ).toBe("action_required");
  });

  it("H: blocked candidate is action_required", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    const blocked = { ...candidate, status: "blocked" as const };
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: blocked.candidateId });
    await runRepo.saveCandidate(blocked);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: BEFORE_NINE_KST },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.candidate.status).toBe("blocked");
    expect(status.overallStatus).toBe("action_required");
  });

  it("I: approved but not published is not system failure", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: candidate.candidateId });
    await runRepo.saveCandidate(candidate);
    const review = createInitialHumanReview(candidate, "ops", NOW_AFTER_RUN);
    review.status = "approved_for_manual_publish";
    await reviewRepo.save(review);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: BEFORE_NINE_KST },
      { runRepo, reviewRepo, perfRepo: createInMemoryContentPerformanceRepository(), researchRepo: createInMemoryResearchRepository(), performanceBriefPath: briefPath, checkSemanticInfrastructure: async () => true },
    );

    expect(status.overallStatus).not.toBe("failed");
    expect(status.humanReview.status).toBe("approved_for_manual_publish");
  });

  it("J: verification fixtures excluded from production operations counts", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const verification = buildVerificationArtifacts(NOW_AFTER_RUN);
    await runRepo.saveCandidate(verification.candidate);
    const production = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveCandidate(production.candidate);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: NOW_AFTER_RUN },
      {
        runRepo,
        reviewRepo: createInMemoryHumanMarketingReviewRepository(),
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(isVerificationRecord({ candidateId: verification.candidate.candidateId })).toBe(true);
    expect(status.candidate.candidateId).toBe(production.candidate.candidateId);
    expect(status.candidate.duplicateCount).toBe(0);
  });

  it("K/L: same-day rerun idempotent and next-day distinct", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const governanceReviewStore = await import("@/lib/marketing/content/governance/store/governanceReviewStore").then(
      (mod) => mod.createInMemoryGovernanceReviewStore(),
    );
    const contentAssignmentStore = await import("@/lib/marketing/content/store/contentAssignmentStore").then((mod) =>
      mod.createInMemoryContentAssignmentStore(),
    );

    const deps = {
      repo: runRepo,
      now: NOW,
      contentAssignmentStore,
      governanceReviewStore,
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
      requestGovernance: async () => ({
        decision: "ALLOW" as const,
        riskScore: 0,
        reasons: ["NO_RISK_SIGNAL"],
        revisionHints: [],
        humanApprovalRequired: false,
        semanticAvailable: true,
      }),
      requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
    };

    const first = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const second = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);

    const nextDay = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: "2026-09-03" },
      deps,
    );
    expect(nextDay.idempotent).toBe(false);
    expect(nextDay.run.logicalRunKey).not.toBe(first.run.logicalRunKey);

    const service = new HumanMarketingReviewService({ candidateRepo: runRepo, reviewRepo, now: () => NOW_AFTER_RUN });
    const queue = await service.listHumanReviewQueue("all");
    expect(queue.pendingCount).toBeGreaterThan(0);
  });

  it("M/N: KST midnight boundary uses Seoul calendar date", () => {
    const beforeMidnightKst = new Date("2026-09-02T14:59:00.000Z");
    const afterMidnightKst = new Date("2026-09-02T15:01:00.000Z");
    expect(formatKstBusinessDate(beforeMidnightKst)).toBe("2026-09-02");
    expect(formatKstBusinessDate(afterMidnightKst)).toBe("2026-09-03");
    expect(
      buildLogicalDailyRunKey({ routineId: DAILY_MARKETING_ROUTINE_ID, businessDateKst: "2026-09-02" }),
    ).toBe("daily-marketing-plan:2026-09-02");
  });

  it("O: trace identifiers preserved", async () => {
    const runRepo = createInMemoryDailyMarketingRunRepository();
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    const { run, candidate } = buildProductionRunAndCandidate(BUSINESS_DATE);
    await runRepo.saveRun({ ...run, status: "completed", completedCandidateId: candidate.candidateId });
    await runRepo.saveCandidate(candidate);
    const review = createInitialHumanReview(candidate, "ops", NOW_AFTER_RUN);
    await reviewRepo.save(review);

    const status = await getDailyMarketingOperationsStatus(
      { businessDateKst: BUSINESS_DATE, now: NOW_AFTER_RUN },
      {
        runRepo,
        reviewRepo,
        perfRepo: createInMemoryContentPerformanceRepository(),
        researchRepo: createInMemoryResearchRepository(),
        performanceBriefPath: briefPath,
        checkSemanticInfrastructure: async () => true,
      },
    );

    expect(status.trace.logicalRunKey).toBe(run.logicalRunKey);
    expect(status.trace.candidateId).toBe(candidate.candidateId);
    expect(status.trace.reviewId).toBe(review.reviewId);
  });

  it("P: poisoned claim_source row handled safely", () => {
    const signal = mapResearchSignalRow(
      {
        id: "11111111-1111-4111-8111-111111111111",
        source_id: "44444444-4444-4444-8444-444444444444",
        source_type: "performance_memory",
        signal_type: "content_performance",
        title: "t",
        summary: "s",
        claim: null,
        claim_source: "internal_record",
        canonical_url: null,
        external_id: "content_performance_snapshot:abc",
        raw_fingerprint: "raw-fingerprint-1234567890ab",
        normalized_fingerprint: "norm-fingerprint-1234567890ab",
        status: "observed",
        observed_at: NOW.toISOString(),
        published_at: null,
        expires_at: null,
        geography: [],
        destinations: [],
        topics: [],
        entities: [],
        language: "ko",
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
        metadata: {},
      },
      [
        {
          id: "22222222-2222-4222-8222-222222222222",
          sourceId: "44444444-4444-4444-8444-444444444444",
          reference: "content_performance_snapshot:abc",
          excerpt: "excerpt",
          observedAt: NOW.toISOString(),
          evidenceType: "internal_record",
        },
      ],
    );
    expect(signal.claimSource).toBeNull();
  });

  it("Q/R/S: degraded dependency classifications documented", async () => {
    const { DEGRADED_DEPENDENCY_MATRIX } = await import("@/lib/marketing/operations/degradedDependencyMatrix");
    expect(DEGRADED_DEPENDENCY_MATRIX.find((row) => row.scenario === "bge_unavailable")?.expectedStatus).toBe(
      "degraded",
    );
    expect(DEGRADED_DEPENDENCY_MATRIX.find((row) => row.scenario === "runtime_gateway_unavailable")?.expectedStatus).toBe(
      "failed",
    );
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);
    const degraded = await loadPerformanceFeedbackSignals({
      repo,
      performanceRepo: perfRepo,
      since: "2026-01-01T00:00:00.000Z",
    });
    expect(degraded.status).toBe("empty");
  });

  it("T/U: operations DTO sanitizes secrets", () => {
    const sanitized = sanitizeOperationsDtoForResponse({
      token: "Bearer super-secret-api-key-value",
      message: "ok",
    });
    expect(JSON.stringify(sanitized)).not.toContain("super-secret-api-key-value");
  });

  it("V: safety invariants remain zero side effects", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
    expect(PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9).toBe(0);
    expect(OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10).toBe(0);
  });

  it("verification snapshots excluded from PA brief enrichment", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await perfRepo.save({
      snapshot: {
        collectionId: "pcol_ver",
        logicalObservationKey: "step-3-9-verification:2026-09-02:obs-1",
        candidateId: "cmc_step_3_9_verification",
        humanReviewId: "hmr_step_3_9_verification",
        platform: "threads",
        channel: "threads",
        publicationSource: "manual",
        contentOrigin: "human_edited",
        collectionStatus: "success",
        observedAt: NOW.toISOString(),
        dataAvailability: "available",
      },
      metrics: [{ metricType: "impressions", metricValue: 100 }],
    });
    const base = {
      version: PERFORMANCE_BRIEF_ARTIFACT_VERSION,
      generatedAt: NOW.toISOString(),
      timezone: PERFORMANCE_BRIEF_TIMEZONE,
      period: { start: "2026-09-01T00:00:00.000Z", end: "2026-09-01T23:59:59.999Z" },
      productId: null,
      channel: "threads",
      sourcesChecked: [],
      availableChannels: [],
      confirmedMetrics: [],
      missingItems: [],
      notableChanges: [],
      managerEvidence: [],
      dataAvailability: "unavailable" as const,
      snsDirectCollection: false as const,
    };
    const enriched = enrichPerformanceBriefWithManualSnapshots(base, await perfRepo.listRecent({ limit: 5 }));
    expect(enriched.confirmedMetrics).toHaveLength(0);
  });
});
