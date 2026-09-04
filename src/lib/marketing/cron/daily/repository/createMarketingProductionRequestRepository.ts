import { createHash, randomUUID } from "node:crypto";

import type {
  FinalizeProductionRequestResult,
  MarketingProductionRequest,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  normalizeProductionRequest,
  sanitizeProductionWorkerError,
} from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { AgendaSlateCandidate, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { buildProductionLogicalRunKey } from "@/lib/marketing/cron/daily/agendaSlate/productionLogicalRunKey";

export type ClaimProductionRequestInput = {
  workerId: string;
  staleAfterMs?: number;
  now?: Date;
};

export type FinalizeOwnership = {
  claimToken: string;
  attemptCount: number;
  workerId: string;
};

export type MarketingProductionRequestRepository = {
  findByLogicalKey(logicalRunKey: string): Promise<MarketingProductionRequest | null>;
  listByBusinessDate(businessDateKst: string): Promise<MarketingProductionRequest[]>;
  listQueued(options?: { limit?: number }): Promise<MarketingProductionRequest[]>;
  /** QUEUED plus stale RUNNING (inspect / dry-run). Does not mutate. */
  listClaimable(options?: {
    limit?: number;
    staleAfterMs?: number;
    now?: Date;
  }): Promise<MarketingProductionRequest[]>;
  /**
   * Atomic claim: QUEUED→RUNNING, or stale RUNNING reclaim.
   * Two concurrent callers must not both receive the same request.
   */
  claimNext(input: ClaimProductionRequestInput): Promise<MarketingProductionRequest | null>;
  /** Insert-once by logical_run_key; returns existing on conflict (idempotent). */
  enqueue(request: MarketingProductionRequest): Promise<{ request: MarketingProductionRequest; created: boolean }>;
  update(request: MarketingProductionRequest): Promise<MarketingProductionRequest>;
  /**
   * Conditional COMPLETED — requires current claim ownership (claimToken + attemptCount).
   * Superseded stale workers receive ownership_lost and must not overwrite.
   */
  markCompleted(input: {
    logicalRunKey: string;
    completedCandidateId: string;
    ownership: FinalizeOwnership;
    now?: Date;
  }): Promise<FinalizeProductionRequestResult>;
  /**
   * Conditional FAILED — same ownership CAS as markCompleted.
   */
  markFailed(input: {
    logicalRunKey: string;
    error: unknown;
    ownership: FinalizeOwnership;
    now?: Date;
  }): Promise<FinalizeProductionRequestResult>;
};

export function createProductionRequestId(logicalRunKey: string): string {
  return `mpr_${createHash("sha256").update(logicalRunKey).digest("hex").slice(0, 24)}`;
}

export function buildQueuedProductionRequest(input: {
  slate: DailyAgendaSlate;
  candidate: AgendaSlateCandidate;
  now?: Date;
  productId?: string | null;
}): MarketingProductionRequest {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const logicalRunKey = buildProductionLogicalRunKey({
    businessDateKst: input.slate.businessDateKst,
    agendaCandidateId: input.candidate.agendaCandidateId,
    researchBriefId: input.candidate.researchBriefId,
    title: input.candidate.title,
    canonicalArticleIds: input.candidate.canonicalArticleIds,
  });
  return normalizeProductionRequest({
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: createProductionRequestId(logicalRunKey),
    logicalRunKey,
    slateId: input.slate.slateId,
    slateItemId: input.candidate.slateItemId,
    businessDateKst: input.slate.businessDateKst,
    status: "QUEUED",
    createdAt: iso,
    updatedAt: iso,
    claimedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attemptCount: 0,
    claimToken: null,
    lastError: null,
    workerId: null,
    selection: {
      title: input.candidate.title,
      summary: input.candidate.summary,
      agendaCandidateId: input.candidate.agendaCandidateId,
      researchBriefId: input.candidate.researchBriefId,
      rationale: input.candidate.rationale,
      recommendedChannel: input.candidate.recommendedChannel,
      recommendedFormats: input.candidate.recommendedFormats,
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: {
      correlationSeed: randomUUID().slice(0, 8),
      origin: input.candidate.origin,
      productId: input.productId ?? null,
      canonicalArticleIds: input.candidate.canonicalArticleIds,
    },
  });
}

function isStaleRunning(
  request: MarketingProductionRequest,
  now: Date,
  staleAfterMs: number,
): boolean {
  if (request.status !== "RUNNING") return false;
  const claimed = request.claimedAt ?? request.startedAt ?? request.updatedAt;
  const claimedMs = Date.parse(claimed);
  if (!Number.isFinite(claimedMs)) return true;
  return now.getTime() - claimedMs >= staleAfterMs;
}

function ownershipMatches(
  request: MarketingProductionRequest,
  ownership: FinalizeOwnership,
): boolean {
  return (
    request.status === "RUNNING" &&
    request.claimToken === ownership.claimToken &&
    request.attemptCount === ownership.attemptCount &&
    request.workerId === ownership.workerId
  );
}

export function ownershipFromClaim(
  request: MarketingProductionRequest,
): FinalizeOwnership {
  if (!request.claimToken || !request.workerId) {
    throw new Error("CLAIM_OWNERSHIP_MISSING");
  }
  return {
    claimToken: request.claimToken,
    attemptCount: request.attemptCount,
    workerId: request.workerId,
  };
}

export function createInMemoryMarketingProductionRequestRepository(): MarketingProductionRequestRepository {
  const byKey = new Map<string, MarketingProductionRequest>();

  function get(logicalRunKey: string): MarketingProductionRequest | null {
    const row = byKey.get(logicalRunKey);
    return row ? normalizeProductionRequest(structuredClone(row)) : null;
  }

  function set(request: MarketingProductionRequest): MarketingProductionRequest {
    const normalized = normalizeProductionRequest(request);
    byKey.set(normalized.logicalRunKey, structuredClone(normalized));
    return get(normalized.logicalRunKey)!;
  }

  return {
    async findByLogicalKey(logicalRunKey) {
      return get(logicalRunKey);
    },
    async listByBusinessDate(businessDateKst) {
      return [...byKey.values()]
        .map((row) => normalizeProductionRequest(row))
        .filter((row) => row.businessDateKst === businessDateKst)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listQueued(options = {}) {
      const limit = options.limit ?? 50;
      return [...byKey.values()]
        .map((row) => normalizeProductionRequest(row))
        .filter((row) => row.status === "QUEUED")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async listClaimable(options = {}) {
      const limit = options.limit ?? 50;
      const now = options.now ?? new Date();
      const staleAfterMs = options.staleAfterMs ?? DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS;
      return [...byKey.values()]
        .map((row) => normalizeProductionRequest(row))
        .filter(
          (row) =>
            row.status === "QUEUED" || isStaleRunning(row, now, staleAfterMs),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async claimNext(input) {
      const workerId = input.workerId?.trim();
      if (!workerId) throw new Error("WORKER_ID_REQUIRED");
      const now = input.now ?? new Date();
      const staleAfterMs = input.staleAfterMs ?? DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS;
      const iso = now.toISOString();
      const claimToken = randomUUID();
      const candidates = [...byKey.values()]
        .map((row) => normalizeProductionRequest(row))
        .filter(
          (row) =>
            row.status === "QUEUED" || isStaleRunning(row, now, staleAfterMs),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const candidate of candidates) {
        const current = byKey.get(candidate.logicalRunKey);
        if (!current) continue;
        if (current.status === "RUNNING" && !isStaleRunning(current, now, staleAfterMs)) {
          continue;
        }
        if (current.status !== "QUEUED" && current.status !== "RUNNING") continue;
        if (current.status === "QUEUED" || isStaleRunning(current, now, staleAfterMs)) {
          return set({
            ...normalizeProductionRequest(current),
            status: "RUNNING",
            claimedAt: iso,
            startedAt: iso,
            completedAt: null,
            failedAt: null,
            attemptCount: (current.attemptCount ?? 0) + 1,
            claimToken,
            lastError: null,
            errorMessage: null,
            workerId,
            updatedAt: iso,
          });
        }
      }
      return null;
    },
    async enqueue(request) {
      const existing = get(request.logicalRunKey);
      if (existing) return { request: existing, created: false };
      return { request: set(normalizeProductionRequest(request)), created: true };
    },
    async update(request) {
      if (!byKey.has(request.logicalRunKey)) {
        throw new Error(`production request not found: ${request.logicalRunKey}`);
      }
      return set(request);
    },
    async markCompleted(input) {
      const existing = get(input.logicalRunKey);
      if (!existing) return { ok: false, reason: "not_found", request: null };
      if (existing.status === "COMPLETED" || existing.status === "FAILED") {
        return { ok: false, reason: "terminal", request: existing };
      }
      if (existing.status !== "RUNNING") {
        return { ok: false, reason: "not_running", request: existing };
      }
      if (!ownershipMatches(existing, input.ownership)) {
        return { ok: false, reason: "ownership_lost", request: existing };
      }
      const now = input.now ?? new Date();
      const iso = now.toISOString();
      return {
        ok: true,
        request: set({
          ...existing,
          status: "COMPLETED",
          completedAt: iso,
          failedAt: null,
          lastError: null,
          errorMessage: null,
          completedCandidateId: input.completedCandidateId,
          updatedAt: iso,
        }),
      };
    },
    async markFailed(input) {
      const existing = get(input.logicalRunKey);
      if (!existing) return { ok: false, reason: "not_found", request: null };
      if (existing.status === "COMPLETED" || existing.status === "FAILED") {
        return { ok: false, reason: "terminal", request: existing };
      }
      if (existing.status !== "RUNNING") {
        return { ok: false, reason: "not_running", request: existing };
      }
      if (!ownershipMatches(existing, input.ownership)) {
        return { ok: false, reason: "ownership_lost", request: existing };
      }
      const now = input.now ?? new Date();
      const iso = now.toISOString();
      const lastError = sanitizeProductionWorkerError(input.error);
      return {
        ok: true,
        request: set({
          ...existing,
          status: "FAILED",
          failedAt: iso,
          completedAt: null,
          lastError,
          errorMessage: lastError,
          updatedAt: iso,
        }),
      };
    },
  };
}

let defaultRepo: MarketingProductionRequestRepository | null = null;

export function getDefaultMarketingProductionRequestRepository(): MarketingProductionRequestRepository {
  if (!defaultRepo) defaultRepo = createInMemoryMarketingProductionRequestRepository();
  return defaultRepo;
}

export function resetDefaultMarketingProductionRequestRepository(): void {
  defaultRepo = null;
}

export function isMarketingProductionRequestRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function createMarketingProductionRequestRepository(deps: {
  backend?: "memory" | "supabase";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
} = {}): Promise<MarketingProductionRequestRepository> {
  if (deps.backend === "memory") {
    return createInMemoryMarketingProductionRequestRepository();
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isMarketingProductionRequestRepositoryConfigured(env)) {
    const { SupabaseMarketingProductionRequestRepository } = await import(
      "@/lib/marketing/cron/daily/repository/supabaseMarketingProductionRequestRepository"
    );
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseMarketingProductionRequestRepository(supabaseAdmin);
  }
  return createInMemoryMarketingProductionRequestRepository();
}
