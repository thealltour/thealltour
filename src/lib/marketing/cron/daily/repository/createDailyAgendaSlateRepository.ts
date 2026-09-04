import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";

export type DailyAgendaSlateRepository = {
  findByLogicalKey(logicalRunKey: string): Promise<DailyAgendaSlate | null>;
  findByBusinessDate(businessDateKst: string): Promise<DailyAgendaSlate | null>;
  listRecent(options?: { limit?: number; beforeBusinessDateKst?: string }): Promise<DailyAgendaSlate[]>;
  /** Insert-once for cron slate creation. */
  saveSlate(slate: DailyAgendaSlate): Promise<DailyAgendaSlate>;
  /** Human review mutations (state transitions). */
  updateSlate(slate: DailyAgendaSlate): Promise<DailyAgendaSlate>;
};

export function createInMemoryDailyAgendaSlateRepository(): DailyAgendaSlateRepository {
  const byKey = new Map<string, DailyAgendaSlate>();

  return {
    async findByLogicalKey(logicalRunKey) {
      return byKey.get(logicalRunKey) ?? null;
    },
    async findByBusinessDate(businessDateKst) {
      const rows = [...byKey.values()].filter((row) => row.businessDateKst === businessDateKst);
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return rows[0] ?? null;
    },
    async listRecent(options = {}) {
      const limit = options.limit ?? 14;
      let rows = [...byKey.values()];
      if (options.beforeBusinessDateKst) {
        rows = rows.filter((row) => row.businessDateKst < options.beforeBusinessDateKst!);
      }
      rows.sort((a, b) => b.businessDateKst.localeCompare(a.businessDateKst));
      return rows.slice(0, limit);
    },
    async saveSlate(slate) {
      const existing = byKey.get(slate.logicalRunKey);
      if (existing) return existing;
      byKey.set(slate.logicalRunKey, structuredClone(slate));
      return byKey.get(slate.logicalRunKey)!;
    },
    async updateSlate(slate) {
      const existing = byKey.get(slate.logicalRunKey);
      if (!existing) {
        throw new Error(`slate not found: ${slate.logicalRunKey}`);
      }
      byKey.set(slate.logicalRunKey, structuredClone(slate));
      return byKey.get(slate.logicalRunKey)!;
    },
  };
}

let defaultRepo: DailyAgendaSlateRepository | null = null;

export function getDefaultDailyAgendaSlateRepository(): DailyAgendaSlateRepository {
  if (!defaultRepo) defaultRepo = createInMemoryDailyAgendaSlateRepository();
  return defaultRepo;
}

export function resetDefaultDailyAgendaSlateRepository(): void {
  defaultRepo = null;
}

export function isDailyAgendaSlateRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function createDailyAgendaSlateRepository(deps: {
  backend?: "memory" | "supabase";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
} = {}): Promise<DailyAgendaSlateRepository> {
  if (deps.backend === "memory") {
    return createInMemoryDailyAgendaSlateRepository();
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isDailyAgendaSlateRepositoryConfigured(env)) {
    const { SupabaseDailyAgendaSlateRepository } = await import(
      "@/lib/marketing/cron/daily/repository/supabaseDailyAgendaSlateRepository"
    );
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseDailyAgendaSlateRepository(supabaseAdmin);
  }
  return createInMemoryDailyAgendaSlateRepository();
}
