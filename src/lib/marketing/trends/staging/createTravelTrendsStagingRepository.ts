import type { TravelTrendsStagingRepository } from "./types";
import { createInMemoryTravelTrendsStagingRepository } from "./inMemoryTravelTrendsStagingRepository";

export type CreateTravelTrendsStagingRepositoryDeps = {
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  client?: { from: (table: string) => unknown } | null;
};

export function isTravelTrendsStagingConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function createTravelTrendsStagingRepository(
  deps: CreateTravelTrendsStagingRepositoryDeps = {},
): Promise<TravelTrendsStagingRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return createInMemoryTravelTrendsStagingRepository();
  }
  const { SupabaseTravelTrendsStagingRepository } = await import(
    "./supabaseTravelTrendsStagingRepository"
  );
  if (deps.client) {
    return new SupabaseTravelTrendsStagingRepository(deps.client);
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isTravelTrendsStagingConfigured(env)) {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseTravelTrendsStagingRepository(supabaseAdmin);
  }
  return createInMemoryTravelTrendsStagingRepository();
}

export type { TravelTrendsStagingRepository, TravelTrendStagingRow } from "./types";
export { createInMemoryTravelTrendsStagingRepository } from "./inMemoryTravelTrendsStagingRepository";
