/**
 * Explicit migration readiness check — does NOT apply migration.
 *
 *   npx tsx scripts/apply-agenda-reservoir-v2-migration-check.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      JSON.stringify(
        {
          tableExists: false,
          productionLiveShadowReady: false,
          reason: "supabase_env_missing",
          migrationFile: "supabase/migrations/20260916120000_marketing_agenda_reservoir_v2.sql",
          additiveOnly: true,
          v1TablesMutated: false,
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("marketing_agenda_reservoir_v2").select("agenda_id").limit(1);
  const missing =
    !!error &&
    (/could not find|does not exist|schema cache/i.test(error.message) ||
      error.message.includes("marketing_agenda_reservoir_v2"));

  const readiness = {
    migrationFile: "supabase/migrations/20260916120000_marketing_agenda_reservoir_v2.sql",
    additiveOnly: true,
    v1TablesMutated: false,
    tableExists: !error,
    productionLiveShadowReady: !error,
    reason: error
      ? missing
        ? "migration_not_applied: apply 20260916120000_marketing_agenda_reservoir_v2.sql explicitly"
        : `reservoir_probe_error:${error.message}`
      : "marketing_agenda_reservoir_v2_ready",
    backend: error ? "blocked" : "supabase",
  };

  console.log(JSON.stringify(readiness, null, 2));
  console.log("");
  if (!readiness.tableExists) {
    console.log("ACTION REQUIRED (explicit):");
    console.log("  Apply additive migration:");
    console.log("  supabase/migrations/20260916120000_marketing_agenda_reservoir_v2.sql");
    console.log("  via your normal Supabase migration workflow.");
    console.log("  Do NOT rename/alter V1 agenda slate tables.");
    process.exitCode = 2;
    return;
  }
  console.log("READY: marketing_agenda_reservoir_v2 exists — Live Shadow durable path OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
