import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { InMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { ResearchDbClient } from "@/lib/marketing/research/repository/dbClient";

export type CreateResearchRepositoryDeps = {
  client?: ResearchDbClient | null;
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isResearchRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function createResearchRepository(
  deps: CreateResearchRepositoryDeps = {},
): Promise<ResearchRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return new InMemoryResearchRepository();
  }
  const { SupabaseResearchRepository } = await import(
    "@/lib/marketing/research/repository/supabaseResearchRepository"
  );
  if (deps.client) {
    return new SupabaseResearchRepository(deps.client);
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isResearchRepositoryConfigured(env)) {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseResearchRepository(supabaseAdmin as unknown as ResearchDbClient);
  }
  return new InMemoryResearchRepository();
}

export { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
