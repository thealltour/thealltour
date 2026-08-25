/**
 * Social repository factory.
 * Supabase implementation is loaded only when a DB client is requested (server-side).
 */

import type { SocialRepository } from "@/lib/marketing/social/repository/contracts";
import { InMemorySocialRepository } from "@/lib/marketing/social/repository/inMemorySocialRepository";
import type { SocialDbClient } from "@/lib/marketing/social/repository/dbClient";

export type CreateSocialRepositoryDeps = {
  /** Inject for tests. Pass null to force in-memory. */
  client?: SocialDbClient | null;
  /** Explicit backend selection for tests */
  backend?: "supabase" | "memory";
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export function isSocialRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Server-side factory. Prefer importing this from server routes/jobs only.
 * Defaults to Supabase when service role env is present; otherwise memory (dev/tests).
 */
export async function createSocialRepository(
  deps: CreateSocialRepositoryDeps = {},
): Promise<SocialRepository> {
  if (deps.backend === "memory" || deps.client === null) {
    return new InMemorySocialRepository();
  }
  const { SupabaseSocialRepository } = await import(
    "@/lib/marketing/social/repository/supabaseSocialRepository"
  );
  if (deps.client) {
    return new SupabaseSocialRepository(deps.client);
  }
  const env = deps.env ?? process.env;
  if (deps.backend === "supabase" || isSocialRepositoryConfigured(env)) {
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseSocialRepository(supabaseAdmin as unknown as SocialDbClient);
  }
  return new InMemorySocialRepository();
}

export function createInMemorySocialRepository(): InMemorySocialRepository {
  return new InMemorySocialRepository();
}
