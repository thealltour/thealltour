/**
 * STEP 3-9 — read-only performance feedback contracts.
 * No publish/write side effects. Manual publication lineage preserved.
 */

export const MANUAL_PERFORMANCE_REFERENCE_CONTRACT = "manual-performance-reference-v1" as const;
export const PERFORMANCE_COLLECTION_REQUEST_CONTRACT = "performance-collection-request-v1" as const;
export const PERFORMANCE_COLLECTION_RESULT_CONTRACT = "performance-collection-result-v1" as const;
export const CONTENT_PERFORMANCE_SNAPSHOT_CONTRACT = "content-performance-snapshot-v1" as const;

export type ContentOrigin = "ai_unchanged" | "human_edited";

export type CollectionEligibilityStatus =
  | "eligible"
  | "insufficient_reference"
  | "unsupported_provider"
  | "auth_required"
  | "unavailable";

export type PerformanceCollectionStatus =
  | "success"
  | "partial"
  | "unsupported"
  | "insufficient_reference"
  | "auth_required"
  | "permission_denied"
  | "not_found"
  | "rate_limited"
  | "temporarily_unavailable"
  | "metrics_not_ready";

export type ManualPerformanceReference = {
  contract: typeof MANUAL_PERFORMANCE_REFERENCE_CONTRACT;
  candidateId: string;
  reviewId: string;
  platform: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  humanEditedAfterGovernance: boolean;
  source: "manual_publication";
  createdAt: string;
};

export type PerformanceCollectionRequest = {
  contract: typeof PERFORMANCE_COLLECTION_REQUEST_CONTRACT;
  collectionId: string;
  candidateId: string;
  reviewId: string;
  platform: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  requestedAt: string;
  correlationId?: string | null;
};

export type PerformanceMetrics = {
  impressions?: number | null;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  watchTimeSeconds?: number | null;
  averageViewDurationSeconds?: number | null;
  subscribersGained?: number | null;
};

export type PerformanceCollectionResult = {
  contract: typeof PERFORMANCE_COLLECTION_RESULT_CONTRACT;
  collectionId: string;
  status: PerformanceCollectionStatus;
  observedAt: string;
  metrics: PerformanceMetrics;
  unavailableMetrics?: string[];
  reason?: string | null;
  providerMetadata?: Record<string, string | number | boolean | null>;
};

export type ContentPerformanceSnapshot = {
  contract: typeof CONTENT_PERFORMANCE_SNAPSHOT_CONTRACT;
  snapshotId: string;
  collectionId: string;
  logicalObservationKey: string;
  candidateId: string;
  humanReviewId: string;
  platform: string;
  channel: string;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt?: string | null;
  publicationSource: "manual";
  contentOrigin: ContentOrigin;
  collectionStatus: PerformanceCollectionStatus;
  observedAt: string;
  dataAvailability: "available" | "partial" | "unavailable";
  metrics: PerformanceMetrics;
  normalizedMetrics?: NormalizedPerformanceFeatures | null;
  topic?: string | null;
  destinations?: string[];
  format?: string | null;
  commercialIntent?: string | null;
  productLinked?: boolean;
  sampleQuality?: string | null;
  reason?: string | null;
  createdAt: string;
};

export type NormalizedPerformanceFeatures = {
  engagementRate?: number | null;
  viewToLikeRate?: number | null;
  shareRate?: number | null;
  saveRate?: number | null;
  clickRate?: number | null;
  ageHoursAtObservation?: number | null;
};

export type PerformanceEvidence = {
  candidateId: string;
  reviewId: string;
  topic?: string | null;
  destinations: string[];
  format?: string | null;
  channel: string;
  commercialIntent?: string | null;
  productLinked: boolean;
  contentOrigin: ContentOrigin;
  observedMetrics: PerformanceMetrics;
  normalizedMetrics?: NormalizedPerformanceFeatures | null;
  observationAgeHours?: number | null;
  sampleQuality?: string | null;
  collectionStatus: PerformanceCollectionStatus;
  collectedAt: string;
  uncertaintyNotes: string[];
};
