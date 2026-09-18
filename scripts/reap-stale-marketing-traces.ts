/**
 * Inventory + optionally finalize stale marketing observability traces.
 *
 * Usage:
 *   npx tsx scripts/reap-stale-marketing-traces.ts [--threshold-min 30] [--limit 200] [--execute]
 */
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./loadLocalEnv";
import { DEFAULT_STALE_RUNNING_MS } from "@/lib/marketing/observability/viewer/live/staleRunning";
import { reapStaleRunningMarketingTraces } from "@/lib/marketing/observability/persistence/reapStaleRunning";

loadLocalEnv();

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const thresholdMin = Number(argValue("--threshold-min") ?? "30");
  const limit = Number(argValue("--limit") ?? "200");
  const thresholdMs = Number.isFinite(thresholdMin)
    ? Math.max(1, thresholdMin) * 60_000
    : DEFAULT_STALE_RUNNING_MS;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("missing supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const result = await reapStaleRunningMarketingTraces({
    client: sb,
    thresholdMs,
    limit,
    dryRun: !execute,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
