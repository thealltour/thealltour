/**
 * Durable reservoir readiness for 5-day Live Shadow.
 * Migration must be applied explicitly — this module only probes.
 */

export type AgendaReservoirMigrationReadiness = {
  migrationFile: "supabase/migrations/20260916120000_marketing_agenda_reservoir_v2.sql";
  additiveOnly: true;
  v1TablesMutated: false;
  tableExists: boolean;
  productionLiveShadowReady: boolean;
  reason: string;
  backend: "supabase" | "json_fallback" | "blocked" | "memory_test";
};

export async function probeAgendaReservoirV2Table(deps?: {
  client?: {
    from: (table: string) => {
      select: (cols: string) => {
        limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  jsonFallbackEnabled?: boolean;
  forceMemory?: boolean;
}): Promise<AgendaReservoirMigrationReadiness> {
  const base = {
    migrationFile: "supabase/migrations/20260916120000_marketing_agenda_reservoir_v2.sql" as const,
    additiveOnly: true as const,
    v1TablesMutated: false as const,
  };

  if (deps?.forceMemory) {
    return {
      ...base,
      tableExists: false,
      productionLiveShadowReady: false,
      reason: "memory_test_backend",
      backend: "memory_test",
    };
  }

  try {
    let client = deps?.client;
    if (!client) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      client = supabaseAdmin as unknown as NonNullable<typeof deps>["client"];
    }
    const { error } = await client!.from("marketing_agenda_reservoir_v2").select("agenda_id").limit(1);
    if (error) {
      const missing =
        /could not find|does not exist|schema cache/i.test(error.message) ||
        error.message.includes("marketing_agenda_reservoir_v2");
      if (missing && deps?.jsonFallbackEnabled) {
        return {
          ...base,
          tableExists: false,
          productionLiveShadowReady: false,
          reason:
            "migration_not_applied; JSON fallback enabled for local only — NOT sufficient for production 5-day Live Shadow",
          backend: "json_fallback",
        };
      }
      return {
        ...base,
        tableExists: false,
        productionLiveShadowReady: false,
        reason: missing
          ? "migration_not_applied: apply 20260916120000_marketing_agenda_reservoir_v2.sql explicitly"
          : `reservoir_probe_error:${error.message}`,
        backend: "blocked",
      };
    }
    return {
      ...base,
      tableExists: true,
      productionLiveShadowReady: true,
      reason: "marketing_agenda_reservoir_v2_ready",
      backend: "supabase",
    };
  } catch (err) {
    if (deps?.jsonFallbackEnabled) {
      return {
        ...base,
        tableExists: false,
        productionLiveShadowReady: false,
        reason: `probe_exception_json_fallback:${err instanceof Error ? err.message : String(err)}`,
        backend: "json_fallback",
      };
    }
    return {
      ...base,
      tableExists: false,
      productionLiveShadowReady: false,
      reason: `probe_exception:${err instanceof Error ? err.message : String(err)}`,
      backend: "blocked",
    };
  }
}
