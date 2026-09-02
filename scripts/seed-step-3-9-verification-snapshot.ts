#!/usr/bin/env node
/**
 * Seed one isolated STEP 3-9 verification ContentPerformanceSnapshot.
 *   npx tsx scripts/seed-step-3-9-verification-snapshot.ts
 *   npx tsx scripts/seed-step-3-9-verification-snapshot.ts --cleanup
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

const PURPOSE = "step-3-9-final-verification";
const LOGICAL_KEY = "step-3-9-verification:2026-09-02:obs-1";
const CANDIDATE_ID = "cmc_step_3_9_verification";
const REVIEW_ID = "hmr_step_3_9_verification";

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const { createContentPerformanceRepository } = await import(
    "../src/lib/marketing/performance/repository/createContentPerformanceRepository"
  );
  const repo = await createContentPerformanceRepository({ backend: "supabase" });

  if (cleanup) {
    const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
    const { data } = await supabaseAdmin
      .from("marketing_content_performance_snapshots")
      .select("id")
      .eq("logical_observation_key", LOGICAL_KEY);
    const ids = (data ?? []).map((row) => String((row as { id: string }).id));
    if (ids.length > 0) {
      await supabaseAdmin.from("marketing_content_performance_metrics").delete().in("snapshot_id", ids);
      await supabaseAdmin
        .from("marketing_content_performance_snapshots")
        .delete()
        .eq("logical_observation_key", LOGICAL_KEY);
    }
    console.log(JSON.stringify({ action: "cleanup", logicalObservationKey: LOGICAL_KEY, removed: ids.length }, null, 2));
    return;
  }

  const existing = await repo.findByLogicalObservationKey(LOGICAL_KEY);
  if (existing) {
    console.log(JSON.stringify({ action: "already_seeded", snapshotId: existing.snapshotId, purpose: PURPOSE }, null, 2));
    return;
  }

  const snapshot = await repo.save({
    snapshot: {
      collectionId: "pcol_step_3_9_verification",
      logicalObservationKey: LOGICAL_KEY,
      candidateId: CANDIDATE_ID,
      humanReviewId: REVIEW_ID,
      platform: "threads",
      channel: "threads",
      externalPostId: "verification_post_no_provider_call",
      publishedAt: "2026-09-01T10:00:00.000Z",
      publicationSource: "manual",
      contentOrigin: "human_edited",
      collectionStatus: "success",
      observedAt: "2026-09-02T01:00:00.000Z",
      dataAvailability: "available",
      topic: "[VERIFICATION] STEP 3-9 performance feedback wiring",
      destinations: ["japan"],
      format: "thread",
      commercialIntent: "awareness",
      productLinked: false,
      sampleQuality: "single_post_sample",
      reason: null,
    },
    metrics: [
      { metricType: "impressions", metricValue: 600 },
      { metricType: "likes", metricValue: 27 },
    ],
  });

  console.log(
    JSON.stringify(
      {
        action: "seeded",
        purpose: PURPOSE,
        snapshotId: snapshot.snapshotId,
        logicalObservationKey: LOGICAL_KEY,
        candidateId: CANDIDATE_ID,
        reviewId: REVIEW_ID,
        note: "No provider call; no ExternalPublication",
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
