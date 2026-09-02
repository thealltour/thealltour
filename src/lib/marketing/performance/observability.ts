import type { ContentPerformanceSnapshot, PerformanceEvidence } from "@/lib/marketing/performance/types";

export type PerformanceCollectionLogEvent = {
  collectionId?: string | null;
  candidateId: string;
  reviewId: string;
  platform: string;
  adapter?: string | null;
  collectionStatus: string;
  snapshotId?: string | null;
  metricNamesAvailable?: string[];
  collectedAt?: string | null;
  durationMs?: number | null;
  correlationId?: string | null;
  failureReason?: string | null;
  contentOrigin?: string | null;
  idempotentReuse?: boolean;
};

const FORBIDDEN_LOG_TOKENS = [
  "access_token",
  "refresh_token",
  "authorization",
  "api_key",
  "service_role",
  "sk-",
];

export function logPerformanceCollectionEvent(event: PerformanceCollectionLogEvent): void {
  const payload = {
    scope: "marketing_performance_collection",
    ...event,
  };
  const serialized = JSON.stringify(payload);
  for (const token of FORBIDDEN_LOG_TOKENS) {
    if (serialized.toLowerCase().includes(token)) {
      throw new Error(`forbidden_observability_token:${token}`);
    }
  }
  if (process.env.NODE_ENV !== "test") {
    console.info(serialized);
  }
}

export function snapshotToPerformanceEvidence(snapshot: ContentPerformanceSnapshot): PerformanceEvidence {
  const uncertaintyNotes: string[] = [];
  if (snapshot.collectionStatus !== "success" && snapshot.collectionStatus !== "partial") {
    uncertaintyNotes.push(`collection_status_${snapshot.collectionStatus}`);
  }
  if (snapshot.sampleQuality) uncertaintyNotes.push(snapshot.sampleQuality);
  if (snapshot.normalizedMetrics?.ageHoursAtObservation != null && snapshot.normalizedMetrics.ageHoursAtObservation < 6) {
    uncertaintyNotes.push("early_observation_lt_6h");
  }
  if (!snapshot.normalizedMetrics?.engagementRate) {
    uncertaintyNotes.push("insufficient_reach_denominator");
  }
  uncertaintyNotes.push("single_post_sample");

  return {
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
    uncertaintyNotes,
  };
}
