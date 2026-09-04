import "server-only";

import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

type DbClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    upsert: (row: unknown, options?: { onConflict?: string }) => unknown;
    update: (row: unknown) => unknown;
  };
};

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected single row");
  }
  return data as Record<string, unknown>;
}

function mapRequest(row: Record<string, unknown>): MarketingProductionRequest {
  return row.payload as MarketingProductionRequest;
}

export class SupabaseMarketingProductionRequestRepository
  implements MarketingProductionRequestRepository
{
  constructor(private readonly client: DbClient) {}

  async findByLogicalKey(logicalRunKey: string): Promise<MarketingProductionRequest | null> {
    const query = this.client.from("daily_marketing_production_requests").select("*") as {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    const { data, error } = await query.eq("logical_run_key", logicalRunKey).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRequest(asRow(data)) : null;
  }

  async listByBusinessDate(businessDateKst: string): Promise<MarketingProductionRequest[]> {
    const query = this.client.from("daily_marketing_production_requests").select("*") as {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    const { data, error } = await query
      .eq("business_date_kst", businessDateKst)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRequest(asRow(row)));
  }

  async listQueued(options: { limit?: number } = {}): Promise<MarketingProductionRequest[]> {
    const limit = options.limit ?? 50;
    const query = this.client.from("daily_marketing_production_requests").select("*") as {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await query
      .eq("status", "QUEUED")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRequest(asRow(row)));
  }

  async enqueue(
    request: MarketingProductionRequest,
  ): Promise<{ request: MarketingProductionRequest; created: boolean }> {
    const existing = await this.findByLogicalKey(request.logicalRunKey);
    if (existing) return { request: existing, created: false };
    const row = {
      request_id: request.requestId,
      logical_run_key: request.logicalRunKey,
      slate_id: request.slateId,
      slate_item_id: request.slateItemId,
      business_date_kst: request.businessDateKst,
      status: request.status,
      payload: request,
      updated_at: request.updatedAt,
    };
    const upsert = this.client.from("daily_marketing_production_requests").upsert(row, {
      onConflict: "logical_run_key",
    }) as {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
    const { data, error } = await upsert.select("*").single();
    if (error) {
      // Race: another writer won — return existing.
      const raced = await this.findByLogicalKey(request.logicalRunKey);
      if (raced) return { request: raced, created: false };
      throw new Error(error.message);
    }
    return { request: mapRequest(asRow(data)), created: true };
  }

  async update(request: MarketingProductionRequest): Promise<MarketingProductionRequest> {
    const update = this.client.from("daily_marketing_production_requests").update({
      status: request.status,
      payload: request,
      updated_at: request.updatedAt,
    }) as {
      eq: (col: string, val: string) => {
        select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
    const { data, error } = await update
      .eq("logical_run_key", request.logicalRunKey)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRequest(asRow(data));
  }
}
