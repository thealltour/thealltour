import "server-only";

import {
  readVectorMemoryRepositoryConfig,
  SupabaseVectorMemoryRepository,
  type VectorMemoryRpcClient,
} from "@/lib/marketing/semantic/supabaseVectorMemoryRepository";
import type { VectorMemoryRepository } from "@/lib/marketing/semantic/types";

export function isVectorMemoryRepositoryConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export type CreateVectorMemoryRepositoryDeps = {
  client?: VectorMemoryRpcClient | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

function defaultSupabaseRpcClient(): VectorMemoryRpcClient {
  return {
    async rpc(fn, args) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      return supabaseAdmin.rpc(fn, args);
    },
  };
}

export function createVectorMemoryRepository(
  deps: CreateVectorMemoryRepositoryDeps = {},
): VectorMemoryRepository | null {
  if (deps.client === null) return null;
  const env = deps.env ?? process.env;
  if (deps.client) {
    return new SupabaseVectorMemoryRepository({
      client: deps.client,
      ...readVectorMemoryRepositoryConfig(env),
    });
  }
  if (!isVectorMemoryRepositoryConfigured(env)) return null;
  return new SupabaseVectorMemoryRepository({
    client: defaultSupabaseRpcClient(),
    ...readVectorMemoryRepositoryConfig(env),
  });
}
