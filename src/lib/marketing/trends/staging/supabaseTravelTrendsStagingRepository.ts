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

export type TravelTrendsDbClient = {
  from: (table: string) => any;
};

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint/i.test(error.message ?? "");
}

export class SupabaseTravelTrendsStagingRepository implements TravelTrendsStagingRepository {
  constructor(private readonly client: TravelTrendsDbClient) {}

  async insertTrendObservations(
    inputs: InsertTrendObservationInput[],
  ): Promise<InsertTrendObservationsResult> {
    const accepted: TravelTrendStagingRow[] = [];
    const duplicates: InsertTrendObservationsResult["duplicates"] = [];

    for (const input of inputs) {
      const payload = input.payload;
      const insertRow = toTravelTrendStagingInsertRow(payload);
      const { data, error } = await this.client
        .from("travel_trends_staging")
        .insert(insertRow)
        .select("*")
        .maybeSingle();

      if (error) {
        if (isUniqueViolation(error)) {
          const existing = await this.findTrendObservationByIdentity(
            payload.provider,
            payload.observation_id,
          );
          duplicates.push({
            observationId: payload.observation_id,
            existingId: existing?.id ?? "unknown",
          });
          continue;
        }
        throw new Error(error.message ?? "insertTrendObservations failed");
      }
      if (data) {
        accepted.push(mapTravelTrendStagingRow(data as Record<string, unknown>));
      }
    }

    return { accepted, duplicates };
  }

  async getNewTrendObservations(limit = 50): Promise<TravelTrendStagingRow[]> {
    const { data, error } = await this.client
      .from("travel_trends_staging")
      .select("*")
      .eq("status", "new")
      .order("observed_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));

    if (error) throw new Error(error.message ?? "getNewTrendObservations failed");
    return (data ?? []).map((row: Record<string, unknown>) => mapTravelTrendStagingRow(row));
  }

  async markTrendObservationIngested(
    id: string,
    ingestedAt = new Date().toISOString(),
  ): Promise<TravelTrendStagingRow | null> {
    const { data, error } = await this.client
      .from("travel_trends_staging")
      .update({
        status: "ingested",
        ingested_at: ingestedAt,
        discarded_at: null,
        discard_reason: null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message ?? "markTrendObservationIngested failed");
    return data ? mapTravelTrendStagingRow(data as Record<string, unknown>) : null;
  }

  async markTrendObservationDiscarded(
    id: string,
    reason: string,
    discardedAt = new Date().toISOString(),
  ): Promise<TravelTrendStagingRow | null> {
    const { data, error } = await this.client
      .from("travel_trends_staging")
      .update({
        status: "discarded",
        discarded_at: discardedAt,
        discard_reason: reason,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message ?? "markTrendObservationDiscarded failed");
    return data ? mapTravelTrendStagingRow(data as Record<string, unknown>) : null;
  }

  async findTrendObservationByIdentity(
    provider: string,
    observationId: string,
  ): Promise<TravelTrendStagingRow | null> {
    const { data, error } = await this.client
      .from("travel_trends_staging")
      .select("*")
      .eq("provider", provider)
      .eq("observation_id", observationId)
      .maybeSingle();
    if (error) throw new Error(error.message ?? "findTrendObservationByIdentity failed");
    return data ? mapTravelTrendStagingRow(data as Record<string, unknown>) : null;
  }

  async listRecentIngested(limit = 20): Promise<TravelTrendStagingRow[]> {
    const { data, error } = await this.client
      .from("travel_trends_staging")
      .select("*")
      .eq("status", "ingested")
      .order("ingested_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));
    if (error) throw new Error(error.message ?? "listRecentIngested failed");
    return (data ?? []).map((row: Record<string, unknown>) => mapTravelTrendStagingRow(row));
  }
}
