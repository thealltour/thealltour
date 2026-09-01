import type { CompletedMarketingCandidate, DailyMarketingRun } from "@/lib/marketing/cron/daily/types";

export type DailyMarketingRunRepository = {
  findRunByLogicalKey(logicalRunKey: string): Promise<DailyMarketingRun | null>;
  findCandidateByLogicalKey(logicalRunKey: string): Promise<CompletedMarketingCandidate | null>;
  findCandidateByCandidateId(candidateId: string): Promise<CompletedMarketingCandidate | null>;
  listCandidates(options?: { limit?: number; businessDateKst?: string }): Promise<CompletedMarketingCandidate[]>;
  saveRun(run: DailyMarketingRun): Promise<DailyMarketingRun>;
  saveCandidate(candidate: CompletedMarketingCandidate): Promise<CompletedMarketingCandidate>;
};

export function createInMemoryDailyMarketingRunRepository(): DailyMarketingRunRepository {
  const runs = new Map<string, DailyMarketingRun>();
  const candidates = new Map<string, CompletedMarketingCandidate>();

  return {
    async findRunByLogicalKey(logicalRunKey) {
      return runs.get(logicalRunKey) ?? null;
    },
    async findCandidateByLogicalKey(logicalRunKey) {
      return candidates.get(logicalRunKey) ?? null;
    },
    async findCandidateByCandidateId(candidateId) {
      for (const candidate of candidates.values()) {
        if (candidate.candidateId === candidateId) return candidate;
      }
      return null;
    },
    async listCandidates(options = {}) {
      const limit = options.limit ?? 50;
      let rows = [...candidates.values()];
      if (options.businessDateKst) {
        rows = rows.filter((row) => row.businessDateKst === options.businessDateKst);
      }
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, limit);
    },
    async saveRun(run) {
      const existing = runs.get(run.logicalRunKey);
      if (existing?.status === "completed" && existing.completedCandidateId) {
        return existing;
      }
      runs.set(run.logicalRunKey, run);
      return run;
    },
    async saveCandidate(candidate) {
      const existing = candidates.get(candidate.logicalRunKey);
      if (existing) return existing;
      candidates.set(candidate.logicalRunKey, candidate);
      return candidate;
    },
  };
}

let defaultRepo: DailyMarketingRunRepository | null = null;

export function getDefaultDailyMarketingRunRepository(): DailyMarketingRunRepository {
  if (!defaultRepo) defaultRepo = createInMemoryDailyMarketingRunRepository();
  return defaultRepo;
}

export function resetDefaultDailyMarketingRunRepository(): void {
  defaultRepo = null;
}

export function isDailyMarketingRunRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function createDailyMarketingRunRepository(deps: {
  backend?: "memory" | "supabase";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
} = {}): Promise<DailyMarketingRunRepository> {
  if (deps.backend === "memory") {
    return createInMemoryDailyMarketingRunRepository();
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isDailyMarketingRunRepositoryConfigured(env)) {
    const { SupabaseDailyMarketingRunRepository } = await import(
      "@/lib/marketing/cron/daily/repository/supabaseDailyMarketingRunRepository"
    );
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseDailyMarketingRunRepository(supabaseAdmin);
  }
  return createInMemoryDailyMarketingRunRepository();
}
