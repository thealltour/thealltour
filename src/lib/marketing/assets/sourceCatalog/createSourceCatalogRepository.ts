import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";

export type CreateMarketingMediaSourceCatalogRepositoryDeps = {
  client?: unknown | null;
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isMarketingMediaSourceCatalogRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Factory for the Global Source Catalog store.
 * Defaults to in-memory when Supabase is not configured (tests / local).
 * Does not apply migrations, call provider APIs, or mutate Candidate packages.
 */
export async function createMarketingMediaSourceCatalogRepository(
  deps: CreateMarketingMediaSourceCatalogRepositoryDeps = {},
): Promise<MarketingMediaSourceCatalogRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return createInMemoryMarketingMediaSourceCatalogRepository();
  }

  const env = deps.env ?? process.env;
  const useSupabase =
    deps.backend === "supabase" ||
    Boolean(deps.client) ||
    isMarketingMediaSourceCatalogRepositoryConfigured(env);

  if (!useSupabase) {
    return createInMemoryMarketingMediaSourceCatalogRepository();
  }

  const { SupabaseMarketingMediaSourceCatalogRepository } = await import(
    "@/lib/marketing/assets/sourceCatalog/supabaseSourceCatalogRepository"
  );

  if (deps.client) {
    return new SupabaseMarketingMediaSourceCatalogRepository({
      client: deps.client as never,
    });
  }

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return new SupabaseMarketingMediaSourceCatalogRepository({
    client: supabaseAdmin as never,
  });
}

export { createInMemoryMarketingMediaSourceCatalogRepository };
