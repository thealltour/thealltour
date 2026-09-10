import { createInMemoryShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";

export type CreateShortformVideoRenderJobRepositoryDeps = {
  client?: unknown | null;
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isShortformVideoRenderJobRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Factory for durable VideoRenderJob store.
 * Defaults to in-memory when Supabase is not configured (tests / local).
 * Does not apply migrations or run workers.
 */
export async function createShortformVideoRenderJobRepository(
  deps: CreateShortformVideoRenderJobRepositoryDeps = {},
): Promise<ShortformVideoRenderJobRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return createInMemoryShortformVideoRenderJobRepository();
  }

  const env = deps.env ?? process.env;
  const useSupabase =
    deps.backend === "supabase" ||
    Boolean(deps.client) ||
    isShortformVideoRenderJobRepositoryConfigured(env);

  if (!useSupabase) {
    return createInMemoryShortformVideoRenderJobRepository();
  }

  const { SupabaseShortformVideoRenderJobRepository } = await import(
    "@/lib/marketing/assets/shortform/renderJob/supabaseRepository"
  );

  if (deps.client) {
    return new SupabaseShortformVideoRenderJobRepository(deps.client as never);
  }

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return new SupabaseShortformVideoRenderJobRepository(supabaseAdmin as never);
}

export { createInMemoryShortformVideoRenderJobRepository };
