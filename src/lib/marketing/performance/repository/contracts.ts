import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";

export type ContentPerformanceMetricRow = {
  metricType: string;
  metricValue: number;
  unit?: string | null;
};

export type ContentPerformanceSnapshotRow = {
  id: string;
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
  contentOrigin: "ai_unchanged" | "human_edited";
  collectionStatus: string;
  observedAt: string;
  dataAvailability: "available" | "partial" | "unavailable";
  topic?: string | null;
  destinations: string[];
  format?: string | null;
  commercialIntent?: string | null;
  productLinked: boolean;
  sampleQuality?: string | null;
  reason?: string | null;
  providerMetadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type CreateContentPerformanceSnapshotInput = {
  snapshot: Omit<ContentPerformanceSnapshot, "contract" | "snapshotId" | "createdAt" | "metrics" | "normalizedMetrics">;
  metrics: ContentPerformanceMetricRow[];
};

export type ContentPerformanceRepository = {
  findByLogicalObservationKey(key: string): Promise<ContentPerformanceSnapshot | null>;
  findByCandidateId(candidateId: string): Promise<ContentPerformanceSnapshot[]>;
  listRecent(input: { since?: string; limit?: number }): Promise<ContentPerformanceSnapshot[]>;
  save(input: CreateContentPerformanceSnapshotInput): Promise<ContentPerformanceSnapshot>;
};
