import "server-only";

import type {
  ClaimProductionRequestInput,
  FinalizeOwnership,
  MarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type {
  FinalizeProductionRequestResult,
  MarketingProductionRequest,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
  normalizeProductionRequest,
  sanitizeProductionWorkerError,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

type DbClient = {
  // Supabase Postgrest builders are thenable; keep loose to match project admin client.
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

function asRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected single row");
  }
  return data as Record<string, unknown>;
}

function mapRequest(row: Record<string, unknown>): MarketingProductionRequest {
  const payload = normalizeProductionRequest(row.payload as MarketingProductionRequest);
  return normalizeProductionRequest({
    ...payload,
    claimedAt: (row.claimed_at as string | null) ?? payload.claimedAt,
    startedAt: (row.started_at as string | null) ?? payload.startedAt,
    completedAt: (row.completed_at as string | null) ?? payload.completedAt,
    failedAt: (row.failed_at as string | null) ?? payload.failedAt,
    attemptCount:
      typeof row.attempt_count === "number" ? row.attempt_count : payload.attemptCount,
    claimToken: (row.claim_token as string | null) ?? payload.claimToken,
    lastError: (row.last_error as string | null) ?? payload.lastError,
    workerId: (row.worker_id as string | null) ?? payload.workerId,
    status: (row.status as MarketingProductionRequest["status"]) ?? payload.status,
  });
}

function toDbPatch(request: MarketingProductionRequest): Record<string, unknown> {
  return {
    status: request.status,
    payload: request,
    claimed_at: request.claimedAt,
    started_at: request.startedAt,
    completed_at: request.completedAt,
    failed_at: request.failedAt,
    attempt_count: request.attemptCount,
    claim_token: request.claimToken,
    last_error: request.lastError,
    worker_id: request.workerId,
    updated_at: request.updatedAt,
  };
}

async function classifyFinalizeMiss(
  self: SupabaseMarketingProductionRequestRepository,
  logicalRunKey: string,
  ownership: FinalizeOwnership,
): Promise<FinalizeProductionRequestResult> {
  const existing = await self.findByLogicalKey(logicalRunKey);
  if (!existing) return { ok: false, reason: "not_found", request: null };
  if (existing.status === "COMPLETED" || existing.status === "FAILED") {
    return { ok: false, reason: "terminal", request: existing };
  }
  if (existing.status !== "RUNNING") {
    return { ok: false, reason: "not_running", request: existing };
  }
  if (
    existing.claimToken !== ownership.claimToken ||
    existing.attemptCount !== ownership.attemptCount ||
    existing.workerId !== ownership.workerId
  ) {
    return { ok: false, reason: "ownership_lost", request: existing };
  }
  return { ok: false, reason: "ownership_lost", request: existing };
}

export class SupabaseMarketingProductionRequestRepository
  implements MarketingProductionRequestRepository
{
  constructor(private readonly client: DbClient) {}

  async findByLogicalKey(logicalRunKey: string): Promise<MarketingProductionRequest | null> {
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .select("*")
      .eq("logical_run_key", logicalRunKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRequest(asRow(data)) : null;
  }

  async listByBusinessDate(businessDateKst: string): Promise<MarketingProductionRequest[]> {
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .select("*")
      .eq("business_date_kst", businessDateKst)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: unknown) => mapRequest(asRow(row)));
  }

  async listQueued(options: { limit?: number } = {}): Promise<MarketingProductionRequest[]> {
    const limit = options.limit ?? 50;
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .select("*")
      .eq("status", "QUEUED")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: unknown) => mapRequest(asRow(row)));
  }

  async listClaimable(options: {
    limit?: number;
    staleAfterMs?: number;
    now?: Date;
  } = {}): Promise<MarketingProductionRequest[]> {
    const limit = options.limit ?? 50;
    const now = options.now ?? new Date();
    const staleAfterMs = options.staleAfterMs ?? DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS;
    const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();

    const queued = await this.listQueued({ limit });
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .select("*")
      .eq("status", "RUNNING")
      .lt("claimed_at", staleBefore)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const staleRunning = (data ?? []).map((row: unknown) => mapRequest(asRow(row)));
    return [...queued, ...staleRunning]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async claimNext(input: ClaimProductionRequestInput): Promise<MarketingProductionRequest | null> {
    const workerId = input.workerId?.trim();
    if (!workerId) throw new Error("WORKER_ID_REQUIRED");
    const now = input.now ?? new Date();
    const staleAfterMs = input.staleAfterMs ?? DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS;

    const { data, error } = await this.client.rpc("claim_daily_marketing_production_request", {
      p_worker_id: workerId,
      p_stale_after_ms: staleAfterMs,
      p_now: now.toISOString(),
    });
    if (error) throw new Error(error.message);
    if (!data) return null;
    return normalizeProductionRequest(data as MarketingProductionRequest);
  }

  async enqueue(
    request: MarketingProductionRequest,
  ): Promise<{ request: MarketingProductionRequest; created: boolean }> {
    const existing = await this.findByLogicalKey(request.logicalRunKey);
    if (existing) return { request: existing, created: false };
    const normalized = normalizeProductionRequest(request);
    const row = {
      request_id: normalized.requestId,
      logical_run_key: normalized.logicalRunKey,
      slate_id: normalized.slateId,
      slate_item_id: normalized.slateItemId,
      business_date_kst: normalized.businessDateKst,
      status: normalized.status,
      payload: normalized,
      claimed_at: normalized.claimedAt,
      started_at: normalized.startedAt,
      completed_at: normalized.completedAt,
      failed_at: normalized.failedAt,
      attempt_count: normalized.attemptCount,
      claim_token: normalized.claimToken,
      last_error: normalized.lastError,
      worker_id: normalized.workerId,
      updated_at: normalized.updatedAt,
    };
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .upsert(row, { onConflict: "logical_run_key" })
      .select("*")
      .single();
    if (error) {
      const raced = await this.findByLogicalKey(request.logicalRunKey);
      if (raced) return { request: raced, created: false };
      throw new Error(error.message);
    }
    return { request: mapRequest(asRow(data)), created: true };
  }

  async update(request: MarketingProductionRequest): Promise<MarketingProductionRequest> {
    const normalized = normalizeProductionRequest(request);
    const { data, error } = await this.client
      .from("daily_marketing_production_requests")
      .update(toDbPatch(normalized))
      .eq("logical_run_key", normalized.logicalRunKey)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRequest(asRow(data));
  }

  async markCompleted(input: {
    logicalRunKey: string;
    completedCandidateId: string;
    ownership: FinalizeOwnership;
    now?: Date;
  }): Promise<FinalizeProductionRequestResult> {
    const now = input.now ?? new Date();
    const { data, error } = await this.client.rpc(
      "finalize_daily_marketing_production_request_completed",
      {
        p_logical_run_key: input.logicalRunKey,
        p_completed_candidate_id: input.completedCandidateId,
        p_claim_token: input.ownership.claimToken,
        p_attempt_count: input.ownership.attemptCount,
        p_worker_id: input.ownership.workerId,
        p_now: now.toISOString(),
      },
    );
    if (error) throw new Error(error.message);
    if (!data) return classifyFinalizeMiss(this, input.logicalRunKey, input.ownership);
    return { ok: true, request: normalizeProductionRequest(data as MarketingProductionRequest) };
  }

  async markFailed(input: {
    logicalRunKey: string;
    error: unknown;
    ownership: FinalizeOwnership;
    now?: Date;
  }): Promise<FinalizeProductionRequestResult> {
    const now = input.now ?? new Date();
    const lastError = sanitizeProductionWorkerError(input.error);
    const { data, error } = await this.client.rpc(
      "finalize_daily_marketing_production_request_failed",
      {
        p_logical_run_key: input.logicalRunKey,
        p_last_error: lastError,
        p_claim_token: input.ownership.claimToken,
        p_attempt_count: input.ownership.attemptCount,
        p_worker_id: input.ownership.workerId,
        p_now: now.toISOString(),
      },
    );
    if (error) throw new Error(error.message);
    if (!data) return classifyFinalizeMiss(this, input.logicalRunKey, input.ownership);
    return { ok: true, request: normalizeProductionRequest(data as MarketingProductionRequest) };
  }
}
