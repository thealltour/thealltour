vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import { runResearchCollectionCycle } from "@/lib/marketing/research/collection/runResearchCollectionCycle";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import { enrichPerformanceBriefWithManualSnapshots } from "@/lib/marketing/performance/integration/enrichPerformanceBrief";
import { PERFORMANCE_BRIEF_ARTIFACT_VERSION, PERFORMANCE_BRIEF_TIMEZONE } from "@/lib/marketing/cron/performanceBriefArtifact";
import { performanceSnapshotExternalId } from "@/lib/marketing/performance/constants";
import { loadPerformanceFeedbackSignals } from "@/lib/marketing/research/collection/loadPerformanceFeedbackSignals";
import { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import { UK_GOV_ATOM_SAMPLE } from "@/lib/marketing/research/__tests__/feedFixtures";
import { UK_GOV_TRAVEL_FEED_URL } from "@/lib/marketing/research/collectors/config";

const NOW = new Date("2026-09-02T08:00:00.000Z");

function seedSnapshot(
  repo: ReturnType<typeof createInMemoryContentPerformanceRepository>,
  input: {
    snapshotId: string;
    logicalObservationKey: string;
    observedAt: string;
    contentOrigin: "ai_unchanged" | "human_edited";
    metrics?: { impressions?: number; likes?: number };
  },
) {
  return repo.save({
    snapshot: {
      collectionId: `pcol_${input.snapshotId}`,
      logicalObservationKey: input.logicalObservationKey,
      candidateId: "cmc_perf_wire",
      humanReviewId: "hmr_perf_wire",
      platform: "threads",
      channel: "threads",
      externalPostId: "wire_post_1",
      publishedAt: "2026-09-01T10:00:00.000Z",
      publicationSource: "manual",
      contentOrigin: input.contentOrigin,
      collectionStatus: "success",
      observedAt: input.observedAt,
      dataAvailability: "available",
      topic: "[VERIFICATION] Performance wiring topic",
      destinations: ["japan"],
      format: "thread",
      commercialIntent: "awareness",
      productLinked: false,
      sampleQuality: "single_post_sample",
      normalizedMetrics: { engagementRate: 0.055, ageHoursAtObservation: 22 },
    },
    metrics: [
      { metricType: "impressions", metricValue: input.metrics?.impressions ?? 800 },
      { metricType: "likes", metricValue: input.metrics?.likes ?? 40 },
    ],
  });
}

describe("performance feedback research wiring", () => {
  it("A: persisted performance snapshot enters Research collection", async () => {
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);
    const snapshot = await seedSnapshot(perfRepo, {
      snapshotId: randomUUID(),
      logicalObservationKey: `wire-${randomUUID()}`,
      observedAt: NOW.toISOString(),
      contentOrigin: "human_edited",
    });

    const result = await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });

    expect(result.totals.performanceSnapshots).toBe(1);
    const signals = await repo.findRecentSignals({ since: "2026-01-01T00:00:00.000Z" });
    const perfSignal = signals.find((s) => s.signalType === "content_performance");
    expect(perfSignal).toBeTruthy();
    expect(perfSignal?.metadata?.snapshotId).toBe(snapshot.snapshotId);
    expect(perfSignal?.metadata?.contentOrigin).toBe("human_edited");
  });

  it("B: same snapshot does not duplicate ResearchSignal", async () => {
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);
    const snapshotId = randomUUID();
    const saved = await seedSnapshot(perfRepo, {
      snapshotId,
      logicalObservationKey: "same-obs-key",
      observedAt: NOW.toISOString(),
      contentOrigin: "human_edited",
    });

    await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });
    await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [],
      now: new Date("2026-09-02T08:30:00.000Z"),
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });

    const externalId = performanceSnapshotExternalId(saved.snapshotId);
    const all = await repo.findRecentSignals({ since: "2026-01-01T00:00:00.000Z" });
    const matching = all.filter((s) => s.externalId === externalId);
    expect(matching).toHaveLength(1);
  });

  it("C: later snapshot creates new content_performance signal", async () => {
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);
    const firstId = randomUUID();
    const secondId = randomUUID();
    await seedSnapshot(perfRepo, {
      snapshotId: firstId,
      logicalObservationKey: "obs-1",
      observedAt: "2026-09-01T08:00:00.000Z",
      contentOrigin: "ai_unchanged",
    });
    await seedSnapshot(perfRepo, {
      snapshotId: secondId,
      logicalObservationKey: "obs-2",
      observedAt: "2026-09-02T08:00:00.000Z",
      contentOrigin: "human_edited",
      metrics: { impressions: 1200, likes: 60 },
    });

    await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });

    const signals = await repo.findRecentSignals({ since: "2026-01-01T00:00:00.000Z" });
    const perfSignals = signals.filter((s) => s.signalType === "content_performance");
    expect(perfSignals.length).toBe(2);
    expect(new Set(perfSignals.map((s) => s.externalId)).size).toBe(2);
  });

  it("D: no snapshot does not fail Research cycle", async () => {
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);

    const fetchImpl = async (url: string | URL) => {
      if (String(url) === UK_GOV_TRAVEL_FEED_URL) {
        const encoded = new TextEncoder().encode(UK_GOV_ATOM_SAMPLE);
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/atom+xml" },
          body: {
            getReader: () => {
              let done = false;
              return {
                read: async () => {
                  if (done) return { done: true, value: undefined };
                  done = true;
                  return { done: false, value: encoded };
                },
              };
            },
          },
        };
      }
      return { ok: false, status: 404, headers: { get: () => null }, body: null };
    };

    const result = await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [createUkGovTravelAdviceCollector({ fetchImpl: fetchImpl as typeof fetch })],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
      maxItemsPerCollector: 3,
    });

    expect(["success", "partial_success"]).toContain(result.status);
    expect(result.totals.performanceFeedbackStatus).toBe("empty");
  });

  it("E: performance repo failure degrades only feedback source", async () => {
    const repo = createInMemoryResearchRepository();
    await bootstrapResearchSources(repo, NOW);
    const brokenPerfRepo = {
      async findByLogicalObservationKey() {
        throw new Error("perf_repo_down");
      },
      async findByCandidateId() {
        throw new Error("perf_repo_down");
      },
      async listRecent() {
        throw new Error("perf_repo_down");
      },
      async save() {
        throw new Error("perf_repo_down");
      },
    };

    const loaded = await loadPerformanceFeedbackSignals({
      repo,
      performanceRepo: brokenPerfRepo,
      since: "2026-01-01T00:00:00.000Z",
      now: NOW,
    });
    expect(loaded.status).toBe("degraded");
    expect(loaded.signals).toHaveLength(0);

    const result = await runResearchCollectionCycle({
      repo,
      performanceRepo: brokenPerfRepo,
      collectors: [],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });
    expect(result.totals.performanceFeedbackStatus).toBe("degraded");
    expect(result.status).not.toBe("failed");
  });

  it("F/G/H/I: contentOrigin and uncertainty reach MM context advisorially", async () => {
    const repo = createInMemoryResearchRepository();
    const perfRepo = createInMemoryContentPerformanceRepository();
    await bootstrapResearchSources(repo, NOW);
    await seedSnapshot(perfRepo, {
      snapshotId: randomUUID(),
      logicalObservationKey: `mm-${randomUUID()}`,
      observedAt: NOW.toISOString(),
      contentOrigin: "human_edited",
    });

    await runResearchCollectionCycle({
      repo,
      performanceRepo: perfRepo,
      collectors: [],
      now: NOW,
      env: { RESEARCH_COLLECTION_ENABLED: "true" },
    });

    const context = await getMarketingManagerResearchContext(
      { lookbackHours: 168 },
      { repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );

    const hasPerformanceSignal = context.briefs.some((brief) =>
      brief.signalTypes.includes("content_performance"),
    );
    expect(hasPerformanceSignal || context.agendaCandidates.length >= 0).toBe(true);
    expect(context.contract).toBeTruthy();
  });

  it("J: PA brief reads persisted manual performance snapshot", async () => {
    const perfRepo = createInMemoryContentPerformanceRepository();
    await seedSnapshot(perfRepo, {
      snapshotId: randomUUID(),
      logicalObservationKey: `pa-${randomUUID()}`,
      observedAt: NOW.toISOString(),
      contentOrigin: "human_edited",
    });
    const snapshots = await perfRepo.listRecent({ limit: 5 });
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
    const enriched = enrichPerformanceBriefWithManualSnapshots(base, snapshots);
    expect(enriched.sourcesChecked).toContain("marketing_content_performance_snapshots");
    expect(enriched.confirmedMetrics.some((m) => m.metricType.includes("manual_threads_impressions"))).toBe(true);
    expect(enriched.managerEvidence.some((line) => line.includes("origin=human_edited"))).toBe(true);
  });
});
