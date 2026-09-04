import { createHash, randomUUID } from "node:crypto";

import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import { MARKETING_PRODUCTION_REQUEST_CONTRACT } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { AgendaSlateCandidate, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { buildProductionLogicalRunKey } from "@/lib/marketing/cron/daily/agendaSlate/productionLogicalRunKey";

export type MarketingProductionRequestRepository = {
  findByLogicalKey(logicalRunKey: string): Promise<MarketingProductionRequest | null>;
  listByBusinessDate(businessDateKst: string): Promise<MarketingProductionRequest[]>;
  listQueued(options?: { limit?: number }): Promise<MarketingProductionRequest[]>;
  /** Insert-once by logical_run_key; returns existing on conflict (idempotent). */
  enqueue(request: MarketingProductionRequest): Promise<{ request: MarketingProductionRequest; created: boolean }>;
  update(request: MarketingProductionRequest): Promise<MarketingProductionRequest>;
};

export function createProductionRequestId(logicalRunKey: string): string {
  return `mpr_${createHash("sha256").update(logicalRunKey).digest("hex").slice(0, 24)}`;
}

export function buildQueuedProductionRequest(input: {
  slate: DailyAgendaSlate;
  candidate: AgendaSlateCandidate;
  now?: Date;
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
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: createProductionRequestId(logicalRunKey),
    logicalRunKey,
    slateId: input.slate.slateId,
    slateItemId: input.candidate.slateItemId,
    businessDateKst: input.slate.businessDateKst,
    status: "QUEUED",
    createdAt: iso,
    updatedAt: iso,
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
    },
  };
}

export function createInMemoryMarketingProductionRequestRepository(): MarketingProductionRequestRepository {
  const byKey = new Map<string, MarketingProductionRequest>();

  return {
    async findByLogicalKey(logicalRunKey) {
      return byKey.get(logicalRunKey) ?? null;
    },
    async listByBusinessDate(businessDateKst) {
      return [...byKey.values()]
        .filter((row) => row.businessDateKst === businessDateKst)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async listQueued(options = {}) {
      const limit = options.limit ?? 50;
      return [...byKey.values()]
        .filter((row) => row.status === "QUEUED")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    async enqueue(request) {
      const existing = byKey.get(request.logicalRunKey);
      if (existing) return { request: existing, created: false };
      byKey.set(request.logicalRunKey, structuredClone(request));
      return { request: byKey.get(request.logicalRunKey)!, created: true };
    },
    async update(request) {
      if (!byKey.has(request.logicalRunKey)) {
        throw new Error(`production request not found: ${request.logicalRunKey}`);
      }
      byKey.set(request.logicalRunKey, structuredClone(request));
      return byKey.get(request.logicalRunKey)!;
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
