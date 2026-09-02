import { randomUUID } from "node:crypto";

import type { PerformanceSignalAdapter } from "@/lib/marketing/research/repository/contracts";
import type { RawResearchSignalInput } from "@/lib/marketing/research/types/researchSignal";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";
import {
  PERFORMANCE_MEMORY_SOURCE_ID,
  performanceSnapshotExternalId,
} from "@/lib/marketing/performance/constants";
import { buildPerformanceMemoryDocument } from "@/lib/marketing/performance/memory/performanceEvidence";
import { isVerificationRecord, STEP_3_9_VERIFICATION_PURPOSE } from "@/lib/marketing/operations/verification";
import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";

export function mapSnapshotToPerformanceSignal(snapshot: ContentPerformanceSnapshot): RawResearchSignalInput {
  const doc = buildPerformanceMemoryDocument({
    candidateId: snapshot.candidateId,
    reviewId: snapshot.humanReviewId,
    topic: snapshot.topic,
    destinations: snapshot.destinations ?? [],
    format: snapshot.format,
    channel: snapshot.channel,
    commercialIntent: snapshot.commercialIntent,
    productLinked: snapshot.productLinked ?? false,
    contentOrigin: snapshot.contentOrigin,
    observedMetrics: snapshot.metrics,
    normalizedMetrics: snapshot.normalizedMetrics,
    observationAgeHours: snapshot.normalizedMetrics?.ageHoursAtObservation ?? null,
    sampleQuality: snapshot.sampleQuality,
    collectionStatus: snapshot.collectionStatus,
    collectedAt: snapshot.observedAt,
    uncertaintyNotes: [
      snapshot.sampleQuality ?? "unknown_sample_quality",
      snapshot.collectionStatus !== "success" && snapshot.collectionStatus !== "partial"
        ? `collection_status_${snapshot.collectionStatus}`
        : "",
    ].filter(Boolean),
  });

  const externalId = performanceSnapshotExternalId(snapshot.snapshotId);
  const verification = isVerificationRecord({
    candidateId: snapshot.candidateId,
    logicalObservationKey: snapshot.logicalObservationKey,
  });

  return {
    sourceId: PERFORMANCE_MEMORY_SOURCE_ID,
    sourceType: "performance_memory",
    signalType: "content_performance",
    title: doc.title,
    summary: doc.body,
    claim: snapshot.topic ?? doc.title,
    claimSource: "derived",
    externalId,
    evidence: [
      {
        id: randomUUID(),
        sourceId: PERFORMANCE_MEMORY_SOURCE_ID,
        reference: externalId,
        excerpt: doc.body.slice(0, 500),
        observedAt: snapshot.observedAt,
        evidenceType: "internal_record",
      },
    ],
    geography: [],
    destinations: snapshot.destinations ?? [],
    topics: ["performance", snapshot.channel],
    entities: [],
    language: "ko",
    observedAt: snapshot.observedAt,
    status: "observed",
    metadata: {
      purpose: verification ? STEP_3_9_VERIFICATION_PURPOSE : undefined,
      snapshotId: snapshot.snapshotId,
      candidateId: snapshot.candidateId,
      reviewId: snapshot.humanReviewId,
      contentOrigin: snapshot.contentOrigin,
      collectionStatus: snapshot.collectionStatus,
      sampleQuality: snapshot.sampleQuality ?? "unknown",
      advisoryOnly: true,
      logicalObservationKey: snapshot.logicalObservationKey,
    },
  };
}

export function createPerformanceSignalAdapter(
  repository: ContentPerformanceRepository,
): PerformanceSignalAdapter {
  return {
    async loadNormalizedSignals(input: { since: string }): Promise<RawResearchSignalInput[]> {
      const snapshots = await repository.listRecent({ since: input.since, limit: 50 });
      return snapshots
        .filter(
          (snapshot) =>
            !isVerificationRecord({
              candidateId: snapshot.candidateId,
              logicalObservationKey: snapshot.logicalObservationKey,
            }),
        )
        .map(mapSnapshotToPerformanceSignal);
    },
  };
}
