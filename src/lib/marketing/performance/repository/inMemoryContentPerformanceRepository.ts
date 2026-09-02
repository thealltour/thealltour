import { randomUUID } from "node:crypto";

import type { ContentPerformanceRepository, CreateContentPerformanceSnapshotInput } from "@/lib/marketing/performance/repository/contracts";
import type { ContentPerformanceSnapshot, PerformanceMetrics } from "@/lib/marketing/performance/types";

function metricsToRows(metrics: PerformanceMetrics) {
  const rows: Array<{ metricType: string; metricValue: number; unit?: string | null }> = [];
  for (const [metricType, value] of Object.entries(metrics)) {
    if (value == null || !Number.isFinite(value)) continue;
    rows.push({ metricType, metricValue: value });
  }
  return rows;
}

function rowsToMetrics(rows: Array<{ metricType: string; metricValue: number }>): PerformanceMetrics {
  const metrics: PerformanceMetrics = {};
  for (const row of rows) {
    const key = row.metricType as keyof PerformanceMetrics;
    metrics[key] = row.metricValue;
  }
  return metrics;
}

function mapSnapshot(
  input: CreateContentPerformanceSnapshotInput,
  snapshotId: string,
  createdAt: string,
  metrics: PerformanceMetrics,
): ContentPerformanceSnapshot {
  return {
    contract: "content-performance-snapshot-v1",
    snapshotId,
    collectionId: input.snapshot.collectionId,
    logicalObservationKey: input.snapshot.logicalObservationKey,
    candidateId: input.snapshot.candidateId,
    humanReviewId: input.snapshot.humanReviewId,
    platform: input.snapshot.platform,
    channel: input.snapshot.channel,
    externalPostId: input.snapshot.externalPostId ?? null,
    externalUrl: input.snapshot.externalUrl ?? null,
    publishedAt: input.snapshot.publishedAt ?? null,
    publicationSource: "manual",
    contentOrigin: input.snapshot.contentOrigin,
    collectionStatus: input.snapshot.collectionStatus,
    observedAt: input.snapshot.observedAt,
    dataAvailability: input.snapshot.dataAvailability,
    metrics,
    normalizedMetrics: input.snapshot.normalizedMetrics ?? null,
    topic: input.snapshot.topic ?? null,
    destinations: input.snapshot.destinations ?? [],
    format: input.snapshot.format ?? null,
    commercialIntent: input.snapshot.commercialIntent ?? null,
    productLinked: input.snapshot.productLinked ?? false,
    sampleQuality: input.snapshot.sampleQuality ?? null,
    reason: input.snapshot.reason ?? null,
    createdAt,
  };
}

export function createInMemoryContentPerformanceRepository(): ContentPerformanceRepository {
  const byKey = new Map<string, ContentPerformanceSnapshot>();
  const byCandidate = new Map<string, Set<string>>();

  return {
    async findByLogicalObservationKey(key: string) {
      return byKey.get(key) ?? null;
    },
    async findByCandidateId(candidateId: string) {
      const ids = byCandidate.get(candidateId) ?? new Set();
      return [...ids].map((id) => byKey.get(id)!).filter(Boolean);
    },
    async listRecent(input: { since?: string; limit?: number } = {}) {
      const all = [...byKey.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const filtered = input.since ? all.filter((row) => row.observedAt >= input.since!) : all;
      return filtered.slice(0, input.limit ?? 50);
    },
    async save(input: CreateContentPerformanceSnapshotInput) {
      const existing = byKey.get(input.snapshot.logicalObservationKey);
      if (existing) return existing;

      const snapshotId = randomUUID();
      const createdAt = new Date().toISOString();
      const metrics = rowsToMetrics(input.metrics);
      const snapshot = mapSnapshot(input, snapshotId, createdAt, metrics);
      byKey.set(input.snapshot.logicalObservationKey, snapshot);
      const set = byCandidate.get(snapshot.candidateId) ?? new Set<string>();
      set.add(snapshotId);
      byCandidate.set(snapshot.candidateId, set);
      return snapshot;
    },
  };
}

export function metricsFromCollection(metrics: PerformanceMetrics) {
  return metricsToRows(metrics);
}
