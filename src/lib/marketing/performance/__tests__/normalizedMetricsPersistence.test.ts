import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import {
  deriveNormalizedPerformanceFeatures,
  resolveNormalizedMetricsForPersistence,
} from "@/lib/marketing/performance/normalizeFeatures";
import type { CreateContentPerformanceSnapshotInput } from "@/lib/marketing/performance/repository/contracts";

const BASE_SNAPSHOT: CreateContentPerformanceSnapshotInput["snapshot"] = {
  collectionId: "pcol_eq",
  logicalObservationKey: "eq-test:obs",
  candidateId: "cmc_eq",
  humanReviewId: "hmr_eq",
  platform: "threads",
  channel: "threads",
  externalPostId: "post_1",
  externalUrl: null,
  publishedAt: "2026-09-01T10:00:00.000Z",
  publicationSource: "manual",
  contentOrigin: "ai_unchanged",
  collectionStatus: "success",
  observedAt: "2026-09-02T10:00:00.000Z",
  dataAvailability: "available",
  topic: "eq",
  destinations: [],
  format: "thread",
  commercialIntent: "awareness",
  productLinked: false,
  sampleQuality: "single_post_sample",
  reason: null,
};

describe("performance repository normalizedMetrics persistence", () => {
  it("metrics present: in-memory save matches shared persistence helper", async () => {
    const repo = createInMemoryContentPerformanceRepository();
    const metrics = [
      { metricType: "impressions", metricValue: 100 },
      { metricType: "likes", metricValue: 10 },
    ];
    const saved = await repo.save({
      snapshot: { ...BASE_SNAPSHOT, logicalObservationKey: "eq-present" },
      metrics,
    });
    const expected = resolveNormalizedMetricsForPersistence(
      { impressions: 100, likes: 10 },
      BASE_SNAPSHOT.observedAt,
      BASE_SNAPSHOT.publishedAt,
    );
    expect(saved.normalizedMetrics).toEqual(expected);
    expect(saved.normalizedMetrics?.engagementRate).toBe(0.1);
    expect(saved.metrics.impressions).toBe(100);
  });

  it("metrics absent: normalizedMetrics is null (not fabricated zeros)", async () => {
    const repo = createInMemoryContentPerformanceRepository();
    const saved = await repo.save({
      snapshot: {
        ...BASE_SNAPSHOT,
        logicalObservationKey: "eq-absent",
        collectionStatus: "unsupported",
        dataAvailability: "unavailable",
      },
      metrics: [],
    });
    expect(saved.normalizedMetrics).toBeNull();
    expect(saved.metrics).toEqual({});
    expect(resolveNormalizedMetricsForPersistence({}, BASE_SNAPSHOT.observedAt, BASE_SNAPSHOT.publishedAt)).toBeNull();
  });

  it("unavailable collection with empty metrics stays absent", async () => {
    const repo = createInMemoryContentPerformanceRepository();
    const saved = await repo.save({
      snapshot: {
        ...BASE_SNAPSHOT,
        logicalObservationKey: "eq-unavailable",
        collectionStatus: "temporarily_unavailable",
        dataAvailability: "unavailable",
        reason: "provider_timeout",
      },
      metrics: [],
    });
    expect(saved.normalizedMetrics).toBeNull();
    expect(Object.keys(saved.metrics)).toHaveLength(0);
  });

  it("partial metrics derive rates only from present values", async () => {
    const repo = createInMemoryContentPerformanceRepository();
    const saved = await repo.save({
      snapshot: {
        ...BASE_SNAPSHOT,
        logicalObservationKey: "eq-partial",
        collectionStatus: "partial",
        dataAvailability: "partial",
      },
      metrics: [{ metricType: "likes", metricValue: 5 }],
    });
    expect(saved.normalizedMetrics).not.toBeNull();
    expect(saved.normalizedMetrics?.engagementRate).toBeNull();
    expect(saved.normalizedMetrics?.viewToLikeRate).toBeNull();
    expect(saved.metrics.likes).toBe(5);
    expect(saved.metrics.impressions).toBeUndefined();
  });

  it("observed zero is not treated as absent", async () => {
    const repo = createInMemoryContentPerformanceRepository();
    const saved = await repo.save({
      snapshot: { ...BASE_SNAPSHOT, logicalObservationKey: "eq-zero" },
      metrics: [
        { metricType: "impressions", metricValue: 0 },
        { metricType: "likes", metricValue: 0 },
      ],
    });
    expect(saved.metrics.impressions).toBe(0);
    expect(saved.metrics.likes).toBe(0);
    expect(saved.normalizedMetrics).not.toBeNull();
    // denominator <= 0 → rate null, not fabricated engagement
    expect(saved.normalizedMetrics?.engagementRate).toBeNull();
  });

  it("no normalizedMetrics input is accepted; repos derive via shared helper", () => {
    const derived = deriveNormalizedPerformanceFeatures(
      { impressions: 200, likes: 20, comments: 4 },
      "2026-09-02T10:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
    );
    const persisted = resolveNormalizedMetricsForPersistence(
      { impressions: 200, likes: 20, comments: 4 },
      "2026-09-02T10:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
    );
    expect(persisted).toEqual(derived);
    expect(persisted?.engagementRate).toBe(0.12);
  });

  it("supabase and in-memory share the same persistence helper contract", () => {
    // Both repositories import resolveNormalizedMetricsForPersistence;
    // empty → null, present → derive. This locks the shared contract.
    expect(resolveNormalizedMetricsForPersistence({}, "2026-09-02T00:00:00.000Z", null)).toBeNull();
    expect(
      resolveNormalizedMetricsForPersistence(
        { impressions: 50, likes: 5 },
        "2026-09-02T10:00:00.000Z",
        "2026-09-01T10:00:00.000Z",
      )?.engagementRate,
    ).toBe(0.1);
  });
});
