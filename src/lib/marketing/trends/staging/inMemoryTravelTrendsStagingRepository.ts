import { randomUUID } from "node:crypto";

import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";
import {
  mapTravelTrendStagingRow,
  toTravelTrendStagingInsertRow,
} from "./mappers";
import type {
  InsertTrendObservationInput,
  InsertTrendObservationsResult,
  TravelTrendStagingRow,
  TravelTrendsStagingRepository,
} from "./types";

export class InMemoryTravelTrendsStagingRepository implements TravelTrendsStagingRepository {
  private readonly rows = new Map<string, TravelTrendStagingRow>();

  private identityKey(provider: string, observationId: string): string {
    return `${provider}::${observationId}`;
  }

  async insertTrendObservations(
    inputs: InsertTrendObservationInput[],
  ): Promise<InsertTrendObservationsResult> {
    const accepted: TravelTrendStagingRow[] = [];
    const duplicates: InsertTrendObservationsResult["duplicates"] = [];

    for (const input of inputs) {
      const payload = input.payload;
      const key = this.identityKey(payload.provider, payload.observation_id);
      const existing = [...this.rows.values()].find(
        (r) => this.identityKey(r.provider, r.observationId) === key,
      );
      if (existing) {
        duplicates.push({ observationId: payload.observation_id, existingId: existing.id });
        continue;
      }
      const now = new Date().toISOString();
      const row: TravelTrendStagingRow = {
        id: randomUUID(),
        provider: payload.provider,
        providerRunId: payload.provider_run_id,
        providerRunAt: payload.provider_run_at,
        observationId: payload.observation_id,
        providerClusterHint: payload.provider_cluster_hint ?? null,
        clusterLabel: payload.cluster_label ?? null,
        observedAt: payload.observed_at,
        windowStart: payload.window.start,
        windowEnd: payload.window.end,
        trendType: payload.trend_type,
        verticalTags: payload.vertical_tags ?? [],
        payload,
        status: "new",
        createdAt: now,
        ingestedAt: null,
        discardedAt: null,
        discardReason: null,
      };
      this.rows.set(row.id, row);
      accepted.push(row);
    }
    return { accepted, duplicates };
  }

  async getNewTrendObservations(limit = 50): Promise<TravelTrendStagingRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.status === "new")
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
      .slice(0, Math.max(1, limit));
  }

  async markTrendObservationIngested(
    id: string,
    ingestedAt = new Date().toISOString(),
  ): Promise<TravelTrendStagingRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, status: "ingested" as const, ingestedAt, discardedAt: null, discardReason: null };
    this.rows.set(id, next);
    return next;
  }

  async markTrendObservationDiscarded(
    id: string,
    reason: string,
    discardedAt = new Date().toISOString(),
  ): Promise<TravelTrendStagingRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = {
      ...row,
      status: "discarded" as const,
      discardedAt,
      discardReason: reason,
    };
    this.rows.set(id, next);
    return next;
  }

  async findTrendObservationByIdentity(
    provider: string,
    observationId: string,
  ): Promise<TravelTrendStagingRow | null> {
    return (
      [...this.rows.values()].find(
        (r) => r.provider === provider && r.observationId === observationId,
      ) ?? null
    );
  }

  async listRecentIngested(limit = 20): Promise<TravelTrendStagingRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.status === "ingested")
      .sort(
        (a, b) =>
          Date.parse(b.ingestedAt ?? b.createdAt) - Date.parse(a.ingestedAt ?? a.createdAt),
      )
      .slice(0, Math.max(1, limit));
  }

  async listRecentStaging(limit = 20): Promise<TravelTrendStagingRow[]> {
    return [...this.rows.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(1, limit));
  }

  async countNewTrendObservations(): Promise<number> {
    return [...this.rows.values()].filter((r) => r.status === "new").length;
  }

  /** Test helper */
  seed(payload: TrendSignalPayloadV1): TravelTrendStagingRow {
    const insert = toTravelTrendStagingInsertRow(payload);
    const now = new Date().toISOString();
    const row = mapTravelTrendStagingRow({
      ...insert,
      id: randomUUID(),
      created_at: now,
      ingested_at: null,
      discarded_at: null,
      discard_reason: null,
    });
    this.rows.set(row.id, row);
    return row;
  }
}

export function createInMemoryTravelTrendsStagingRepository(): InMemoryTravelTrendsStagingRepository {
  return new InMemoryTravelTrendsStagingRepository();
}
