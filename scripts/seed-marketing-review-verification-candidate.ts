#!/usr/bin/env node
/**
 * Seed one isolated STEP 3-8 verification candidate into remote Supabase.
 * Does NOT use daily-marketing-plan:{today} logical key.
 *
 *   npx tsx scripts/seed-marketing-review-verification-candidate.ts
 *   npx tsx scripts/seed-marketing-review-verification-candidate.ts --cleanup
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

import type { SupabaseClient } from "@supabase/supabase-js";
import { createDailyMarketingRunRepository } from "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  VERIFICATION_PURPOSE,
  buildVerificationArtifacts,
  buildVerificationIdentity,
} from "../src/lib/marketing/review/verification/buildVerificationCandidate";

async function countTable(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function cleanup(client: SupabaseClient) {
  const identity = buildVerificationIdentity();
  const del = async (table: string, column: string, value: string) => {
    const { error } = await client.from(table).delete().eq(column, value);
    if (error) throw new Error(error.message);
  };
  await del("human_marketing_reviews", "candidate_id", identity.candidateId);
  await del("completed_marketing_candidates", "candidate_id", identity.candidateId);
  await del("daily_marketing_runs", "logical_run_key", identity.logicalRunKey);
}

async function main() {
  const cleanupOnly = process.argv.includes("--cleanup");
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const repo = await createDailyMarketingRunRepository({ backend: "supabase" });

  const before = {
    candidates: await countTable(supabaseAdmin, "completed_marketing_candidates"),
    reviews: await countTable(supabaseAdmin, "human_marketing_reviews"),
    socialPublications: await countTable(supabaseAdmin, "social_publications"),
  };

  if (cleanupOnly) {
    await cleanup(supabaseAdmin);
    console.log(JSON.stringify({ action: "cleanup", logicalRunKey: buildVerificationIdentity().logicalRunKey }, null, 2));
    return;
  }

  const { run, candidate } = buildVerificationArtifacts();
  const existing = await repo.findCandidateByCandidateId(candidate.candidateId);
  if (existing) {
    console.log(
      JSON.stringify(
        {
          action: "already_seeded",
          candidateId: existing.candidateId,
          logicalRunKey: existing.logicalRunKey,
          purpose: VERIFICATION_PURPOSE,
        },
        null,
        2,
      ),
    );
    return;
  }

  await repo.saveRun(run);
  const saved = await repo.saveCandidate(candidate);

  const after = {
    candidates: await countTable(supabaseAdmin, "completed_marketing_candidates"),
    reviews: await countTable(supabaseAdmin, "human_marketing_reviews"),
    socialPublications: await countTable(supabaseAdmin, "social_publications"),
  };

  console.log(
    JSON.stringify(
      {
        action: "seeded",
        purpose: VERIFICATION_PURPOSE,
        candidateId: saved.candidateId,
        runId: saved.runId,
        logicalRunKey: saved.logicalRunKey,
        businessDateKst: saved.businessDateKst,
        status: saved.status,
        governanceDecision: saved.governanceDecision?.decision ?? null,
        productionLogicalRunUntouched: `daily-marketing-plan:${saved.businessDateKst}`,
        counts: { before, after },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
