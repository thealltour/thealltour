import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";
import type { TravelTrendStagingRow, TravelTrendStagingStatus } from "./types";

export function mapTravelTrendStagingRow(row: Record<string, unknown>): TravelTrendStagingRow {
  return {
    id: String(row.id),
    provider: String(row.provider),
    providerRunId: String(row.provider_run_id),
    providerRunAt: new Date(String(row.provider_run_at)).toISOString(),
    observationId: String(row.observation_id),
    providerClusterHint:
      row.provider_cluster_hint == null || row.provider_cluster_hint === ""
        ? null
        : String(row.provider_cluster_hint),
    clusterLabel:
      row.cluster_label == null || row.cluster_label === "" ? null : String(row.cluster_label),
    observedAt: new Date(String(row.observed_at)).toISOString(),
    windowStart: new Date(String(row.window_start)).toISOString(),
    windowEnd: new Date(String(row.window_end)).toISOString(),
    trendType: String(row.trend_type),
    verticalTags: Array.isArray(row.vertical_tags)
      ? row.vertical_tags.filter((t): t is string => typeof t === "string")
      : [],
    payload: row.payload as TrendSignalPayloadV1,
    status: String(row.status) as TravelTrendStagingStatus,
    createdAt: new Date(String(row.created_at)).toISOString(),
    ingestedAt: row.ingested_at ? new Date(String(row.ingested_at)).toISOString() : null,
    discardedAt: row.discarded_at ? new Date(String(row.discarded_at)).toISOString() : null,
    discardReason: row.discard_reason == null ? null : String(row.discard_reason),
  };
}

export function toTravelTrendStagingInsertRow(payload: TrendSignalPayloadV1): Record<string, unknown> {
  return {
    provider: payload.provider,
    provider_run_id: payload.provider_run_id,
    provider_run_at: payload.provider_run_at,
    observation_id: payload.observation_id,
    provider_cluster_hint: payload.provider_cluster_hint ?? null,
    cluster_label: payload.cluster_label ?? null,
    observed_at: payload.observed_at,
    window_start: payload.window.start,
    window_end: payload.window.end,
    trend_type: payload.trend_type,
    vertical_tags: payload.vertical_tags ?? [],
    payload,
    status: "new",
  };
}
