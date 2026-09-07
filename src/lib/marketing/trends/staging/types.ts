import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";

export const TRAVEL_TREND_STAGING_STATUSES = ["new", "ingested", "discarded"] as const;
export type TravelTrendStagingStatus = (typeof TRAVEL_TREND_STAGING_STATUSES)[number];

export type TravelTrendStagingRow = {
  id: string;
  provider: string;
  providerRunId: string;
  providerRunAt: string;
  observationId: string;
  providerClusterHint: string | null;
  clusterLabel: string | null;
  observedAt: string;
  windowStart: string;
  windowEnd: string;
  trendType: string;
  verticalTags: string[];
  payload: TrendSignalPayloadV1;
  status: TravelTrendStagingStatus;
  createdAt: string;
  ingestedAt: string | null;
  discardedAt: string | null;
  discardReason: string | null;
};

export type InsertTrendObservationInput = {
  payload: TrendSignalPayloadV1;
};

export type InsertTrendObservationsResult = {
  accepted: TravelTrendStagingRow[];
  duplicates: Array<{ observationId: string; existingId: string }>;
};

export interface TravelTrendsStagingRepository {
  insertTrendObservations(
    inputs: InsertTrendObservationInput[],
  ): Promise<InsertTrendObservationsResult>;
  getNewTrendObservations(limit?: number): Promise<TravelTrendStagingRow[]>;
  markTrendObservationIngested(id: string, ingestedAt?: string): Promise<TravelTrendStagingRow | null>;
  markTrendObservationDiscarded(
    id: string,
    reason: string,
    discardedAt?: string,
  ): Promise<TravelTrendStagingRow | null>;
  findTrendObservationByIdentity(
    provider: string,
    observationId: string,
  ): Promise<TravelTrendStagingRow | null>;
  listRecentIngested(limit?: number): Promise<TravelTrendStagingRow[]>;
}
