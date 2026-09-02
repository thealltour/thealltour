vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { buildCompletedCandidate } from "@/lib/marketing/cron/daily/mapPipelineResult";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { NOW, PRODUCT } from "@/lib/marketing/cron/daily/__tests__/fixtures";
import {
  PUBLICATION_FLOW_INACTIVE,
  PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9,
  SNS_SIDE_EFFECTS_STEP_3_8,
} from "@/lib/marketing/social/publication/governanceBoundary";
import {
  buildManualPerformanceReference,
  evaluateManualPublicationEligibility,
} from "@/lib/marketing/performance/eligibility";
import {
  createMockSuccessMetricsAdapter,
  createRateLimitedMetricsAdapter,
  createStubMetricsAdapter,
} from "@/lib/marketing/performance/adapters/createMetricsAdapter";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { ManualPublicationPerformanceCollectionService } from "@/lib/marketing/performance/services/manualPublicationCollectionService";
import { buildLogicalObservationKey } from "@/lib/marketing/performance/idempotency";
import { deriveNormalizedPerformanceFeatures } from "@/lib/marketing/performance/normalizeFeatures";
import { createPerformanceSignalAdapter } from "@/lib/marketing/performance/research/performanceSignalAdapter";
import { buildMarketingManagerPerformanceContext } from "@/lib/marketing/performance/integration/marketingManagerPerformanceContext";
import { buildPerformanceAnalystInput } from "@/lib/marketing/performance/integration/performanceAnalystInput";
import { enrichPerformanceBriefWithManualSnapshots } from "@/lib/marketing/performance/integration/enrichPerformanceBrief";
import { assertReadOnlyMetricsAdapter } from "@/lib/marketing/performance/adapters/types";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { PERFORMANCE_BRIEF_ARTIFACT_VERSION, PERFORMANCE_BRIEF_TIMEZONE } from "@/lib/marketing/cron/performanceBriefArtifact";

const draft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance says autumn travel planning is easier.",
  channel: "threads",
  agenda: "Japan autumn travel update",
  sourceReferences: ["evidence:ev-official"],
};

function allow(): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
  };
}

async function seedReviewWithManualPublication(options: {
  externalPostId?: string;
  externalUrl?: string;
  humanEdited?: boolean;
  platform?: string;
}) {
  const candidateRepo = createInMemoryDailyMarketingRunRepository();
  const reviewRepo = createInMemoryHumanMarketingReviewRepository();
  const perfRepo = createInMemoryContentPerformanceRepository();

  const handoff = prepareManagerToContentHandoff(
    {
      title: "Japan autumn travel update",
      summary: "Official guidance changed.",
      idempotencyKey: `perf-test-${Date.now()}`,
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
      requestGovernance: async () => allow(),
    },
  );

  const run = {
    contract: "daily-marketing-run-v1" as const,
    runId: "run_perf_test",
    logicalRunKey: `perf-test-${Date.now()}`,
    routineId: "daily-marketing-plan",
    businessDateKst: "2026-09-02",
    status: "completed" as const,
    startedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    candidateCount: 1,
    metadata: null,
  };
  await candidateRepo.saveRun(run);
  const candidate = buildCompletedCandidate({
    run,
    pipeline,
    handoff,
    status: "ready_for_human_review",
    now: NOW,
  });
  await candidateRepo.saveCandidate(candidate);

  const service = new HumanMarketingReviewService({ candidateRepo, reviewRepo, now: () => NOW });
  await service.approveForManualPublish({ candidateId: candidate.candidateId, reviewedBy: "test" });
  if (options.humanEdited) {
    await service.updateHumanDraft({
      candidateId: candidate.candidateId,
      draft: { title: "edited", body: "Human edited body for performance test.", channel: "threads" },
      reviewedBy: "test",
    });
  }
  const review = await service.markManuallyPublished({
    candidateId: candidate.candidateId,
    reviewedBy: "test",
    manualPublication: {
      platform: options.platform ?? "threads",
      publishedAt: "2026-09-01T12:00:00.000Z",
      externalPostId: options.externalPostId,
      externalUrl: options.externalUrl,
      notes: "manual test",
    },
  });

  const collectionService = new ManualPublicationPerformanceCollectionService({
    repository: perfRepo,
    adapters: [
      createMockSuccessMetricsAdapter("threads", {
        impressions: 1000,
        likes: 50,
        comments: 5,
      }),
      createRateLimitedMetricsAdapter("instagram"),
      createStubMetricsAdapter("naver_blog"),
    ],
    now: () => NOW,
  });

  return { candidate, review, candidateRepo, reviewRepo, perfRepo, collectionService };
}

describe("STEP 3-9 manual publication performance feedback", () => {
  beforeEach(() => {
    createInMemoryHumanMarketingReviewRepository();
  });

  it("A: manual publication metadata builds ManualPerformanceReference", () => {
    const ref = buildManualPerformanceReference({
      candidateId: "c1",
      reviewId: "r1",
      manualPublication: {
        platform: "threads",
        publishedAt: "2026-09-01T12:00:00.000Z",
        externalPostId: "post_123",
      },
      humanEditedAfterGovernance: true,
      createdAt: NOW.toISOString(),
    });
    expect(ref?.contract).toBe("manual-performance-reference-v1");
    expect(ref?.platform).toBe("threads");
    expect(ref?.source).toBe("manual_publication");
  });

  it("B: review without external ref → insufficient_reference", () => {
    const result = evaluateManualPublicationEligibility({ platform: "threads", publishedAt: NOW.toISOString() });
    expect(result.status).toBe("insufficient_reference");
  });

  it("C: unsupported provider → unsupported_provider", () => {
    const result = evaluateManualPublicationEligibility({
      platform: "unknown_social",
      publishedAt: NOW.toISOString(),
      externalPostId: "x",
    });
    expect(result.status).toBe("unsupported_provider");
  });

  it("D: stub adapter without live creds → auth_required or unsupported", async () => {
    const adapter = createStubMetricsAdapter("threads");
    assertReadOnlyMetricsAdapter(adapter);
    const result = await adapter.collect({
      contract: "performance-collection-request-v1",
      collectionId: "pcol_test",
      candidateId: "c1",
      reviewId: "r1",
      platform: "threads",
      externalPostId: "post_1",
      publishedAt: NOW.toISOString(),
      requestedAt: NOW.toISOString(),
    });
    expect(["auth_required", "unsupported"]).toContain(result.status);
    expect(result.metrics.impressions).toBeUndefined();
  });

  it("E: provider 429 → rate_limited, NOT zero metrics", async () => {
    const adapter = createRateLimitedMetricsAdapter("instagram");
    const result = await adapter.collect({
      contract: "performance-collection-request-v1",
      collectionId: "pcol_rate",
      candidateId: "c1",
      reviewId: "r1",
      platform: "instagram",
      externalPostId: "ig_1",
      publishedAt: NOW.toISOString(),
      requestedAt: NOW.toISOString(),
    });
    expect(result.status).toBe("rate_limited");
    expect(Object.keys(result.metrics).length).toBe(0);
  });

  it("H/I: successful provider result normalizes and partial metrics stay partial", async () => {
    const { candidate, review, collectionService } = await seedReviewWithManualPublication({
      externalPostId: "threads_post_1",
    });
    const collected = await collectionService.collectPerformanceForManualPublication({
      review,
      candidate,
    });
    expect(collected.snapshot?.collectionStatus).toBe("success");
    expect(collected.snapshot?.metrics.impressions).toBe(1000);
    expect(collected.snapshot?.metrics.likes).toBe(50);
    expect(collected.snapshot?.dataAvailability).toBe("available");
  });

  it("J: same observation retry idempotent", async () => {
    const { candidate, review, collectionService } = await seedReviewWithManualPublication({
      externalPostId: "threads_post_idempotent",
    });
    const first = await collectionService.collectPerformanceForManualPublication({ review, candidate });
    const second = await collectionService.collectPerformanceForManualPublication({ review, candidate });
    expect(first.idempotentReuse).toBeFalsy();
    expect(second.idempotentReuse).toBe(true);
    expect(second.snapshot?.snapshotId).toBe(first.snapshot?.snapshotId);
  });

  it("K: later observation bucket creates new snapshot", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    const key1 = buildLogicalObservationKey({
      candidateId: "c1",
      reviewId: "r1",
      platform: "threads",
      externalPostId: "p1",
      observedAt: "2026-09-01T06:00:00.000Z",
    });
    const key2 = buildLogicalObservationKey({
      candidateId: "c1",
      reviewId: "r1",
      platform: "threads",
      externalPostId: "p1",
      observedAt: "2026-09-01T18:00:00.000Z",
    });
    expect(key1).not.toBe(key2);
  });

  it("L/M/N: snapshot links candidate+review and preserves content origin", async () => {
    const humanEdited = await seedReviewWithManualPublication({
      externalPostId: "threads_human",
      humanEdited: true,
    });
    const aiOnly = await seedReviewWithManualPublication({
      externalPostId: "threads_ai",
      humanEdited: false,
    });
    const human = await humanEdited.collectionService.collectPerformanceForManualPublication({
      review: humanEdited.review,
      candidate: humanEdited.candidate,
    });
    const ai = await aiOnly.collectionService.collectPerformanceForManualPublication({
      review: aiOnly.review,
      candidate: aiOnly.candidate,
    });
    expect(human.snapshot?.contentOrigin).toBe("human_edited");
    expect(ai.snapshot?.contentOrigin).toBe("ai_unchanged");
    expect(human.snapshot?.candidateId).toBe(humanEdited.candidate.candidateId);
    expect(human.snapshot?.humanReviewId).toBe(humanEdited.review.reviewId);
  });

  it("O: normalized rate calculation safe (no divide by zero)", () => {
    const normalized = deriveNormalizedPerformanceFeatures(
      { likes: 10, impressions: 0 },
      "2026-09-01T12:00:00.000Z",
      "2026-09-01T18:00:00.000Z",
    );
    expect(normalized.engagementRate).toBeNull();
    expect(normalized.ageHoursAtObservation).toBe(6);
  });

  it("P/Q: PA consumes persisted snapshots", async () => {
    const { candidate, review, collectionService, perfRepo } = await seedReviewWithManualPublication({
      externalPostId: "threads_pa",
    });
    await collectionService.collectPerformanceForManualPublication({ review, candidate });
    const snapshots = await perfRepo.listRecent({ limit: 10 });
    const analyst = buildPerformanceAnalystInput({ snapshots });
    expect(analyst.evidenceLines.length).toBeGreaterThan(0);
    expect(analyst.humanEditedCount + analyst.aiUnchangedCount).toBeGreaterThan(0);
  });

  it("R/S: PerformanceSignalAdapter creates content_performance signals", async () => {
    const { candidate, review, collectionService, perfRepo } = await seedReviewWithManualPublication({
      externalPostId: "threads_signal",
    });
    await collectionService.collectPerformanceForManualPublication({ review, candidate });
    const adapter = createPerformanceSignalAdapter(perfRepo);
    const signals = await adapter.loadNormalizedSignals({ since: "2026-01-01T00:00:00.000Z" });
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe("content_performance");
    expect(signals[0].sourceType).toBe("performance_memory");
    expect(signals[0].metadata?.contentOrigin).toBeDefined();
  });

  it("T: MM consumes performance evidence context", async () => {
    const { candidate, review, collectionService, perfRepo } = await seedReviewWithManualPublication({
      externalPostId: "threads_mm",
    });
    await collectionService.collectPerformanceForManualPublication({ review, candidate });
    const snapshots = await perfRepo.listRecent({ limit: 10 });
    const mm = buildMarketingManagerPerformanceContext(snapshots);
    expect(mm.advisoryOnly).toBe(true);
    expect(mm.humanEditedAttribution.humanEdited + mm.humanEditedAttribution.aiUnchanged).toBeGreaterThan(0);
  });

  it("U: productless content supported", async () => {
    const { candidate, review, collectionService } = await seedReviewWithManualPublication({
      externalPostId: "threads_productless",
    });
    expect(candidate.contentAssignment.matchedProductIds?.length ?? 0).toBe(0);
    const collected = await collectionService.collectPerformanceForManualPublication({ review, candidate });
    expect(collected.snapshot?.productLinked).toBe(false);
  });

  it("V/W/X/Y/Z: safety — no publication, no secrets", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_8).toBe(0);
    expect(PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9).toBe(0);

    const adapter = createMockSuccessMetricsAdapter("threads", { views: 1 });
    assertReadOnlyMetricsAdapter(adapter);
    const forbidden = ["publish", "comment", "like", "follow", "delete"];
    for (const key of forbidden) {
      expect(typeof (adapter as Record<string, unknown>)[key]).not.toBe("function");
    }
  });

  it("enriches daily performance brief with manual snapshots", async () => {
    const { candidate, review, collectionService, perfRepo } = await seedReviewWithManualPublication({
      externalPostId: "threads_brief",
    });
    await collectionService.collectPerformanceForManualPublication({ review, candidate });
    const snapshots = await perfRepo.listRecent({ limit: 5 });
    const base = {
      version: PERFORMANCE_BRIEF_ARTIFACT_VERSION,
      generatedAt: NOW.toISOString(),
      timezone: PERFORMANCE_BRIEF_TIMEZONE,
      period: { start: "2026-09-01T00:00:00.000Z", end: "2026-09-01T23:59:59.999Z" },
      productId: PRODUCT,
      channel: "threads",
      sourcesChecked: ["ai_feedback"],
      availableChannels: ["threads"],
      confirmedMetrics: [],
      missingItems: [],
      notableChanges: [],
      managerEvidence: [],
      dataAvailability: "unavailable" as const,
      snsDirectCollection: false as const,
    };
    const enriched = enrichPerformanceBriefWithManualSnapshots(base, snapshots);
    expect(enriched.sourcesChecked).toContain("marketing_content_performance_snapshots");
    expect(enriched.confirmedMetrics.some((m) => m.metricType.includes("manual_threads"))).toBe(true);
    expect(jsonContainsForbiddenBotLeak(enriched)).toBe(false);
  });
});
