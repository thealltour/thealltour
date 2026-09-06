import { parseEmbeddingConfig } from "@/lib/marketing/semantic/embeddingConfig";
import { createInMemoryMarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/inMemorySemanticEmbeddingRepository";
import type { MarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/repository";

export type CreateMarketingSemanticEmbeddingRepositoryDeps = {
  client?: unknown | null;
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isMarketingSemanticEmbeddingRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Factory for the marketing entity embedding store.
 * Defaults to in-memory when Supabase is not configured (tests / local).
 * Does not trigger embedding generation or Agenda behavior.
 */
export async function createMarketingSemanticEmbeddingRepository(
  deps: CreateMarketingSemanticEmbeddingRepositoryDeps = {},
): Promise<MarketingSemanticEmbeddingRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return createInMemoryMarketingSemanticEmbeddingRepository();
  }

  const env = deps.env ?? process.env;
  const useSupabase =
    deps.backend === "supabase" ||
    Boolean(deps.client) ||
    isMarketingSemanticEmbeddingRepositoryConfigured(env);

  if (!useSupabase) {
    return createInMemoryMarketingSemanticEmbeddingRepository();
  }

  const { SupabaseMarketingSemanticEmbeddingRepository } = await import(
    "@/lib/marketing/semantic/entityEmbeddings/supabaseSemanticEmbeddingRepository"
  );
  const parsed = parseEmbeddingConfig(env);
  const defaults =
    parsed.kind === "mini_pc" || parsed.kind === "http"
      ? { defaultModel: parsed.model, defaultDimension: parsed.dimension }
      : {};

  if (deps.client) {
    return new SupabaseMarketingSemanticEmbeddingRepository({
      client: deps.client as never,
      ...defaults,
    });
  }

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return new SupabaseMarketingSemanticEmbeddingRepository({
    client: supabaseAdmin as never,
    ...defaults,
  });
}

export { createInMemoryMarketingSemanticEmbeddingRepository };
