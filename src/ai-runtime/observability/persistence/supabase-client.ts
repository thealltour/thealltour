import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ObservabilityDbClient } from "@/ai-runtime/observability/persistence/types";

/**
 * Cron/Next-safe Supabase client for observability only.
 * Does not import `server-only` so `npx tsx` Cron can write shared telemetry.
 * Never logs the service role key.
 */
export function createObservabilitySupabaseClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): ObservabilityDbClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const client: SupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client as unknown as ObservabilityDbClient;
}
