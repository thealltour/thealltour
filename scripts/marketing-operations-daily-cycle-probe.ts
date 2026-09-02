#!/usr/bin/env node
/**
 * STEP 3-10 production-equivalent daily cycle probe (isolated verification routine).
 *   npx tsx scripts/marketing-operations-daily-cycle-probe.ts
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

const ROUTINE_ID = "step-3-10-verification";
const BUSINESS_DATE = "2099-01-15";

async function main() {
  const { buildLogicalDailyRunKey } = await import("@/lib/marketing/cron/daily/kstBusinessDate");
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createContentPerformanceRepository } = await import(
    "@/lib/marketing/performance/repository/createContentPerformanceRepository"
  );
  const { createResearchRepository } = await import("@/lib/marketing/research/repository/createResearchRepository");
  const { runResearchCollectionCycle } = await import("@/lib/marketing/research/collection/runResearchCollectionCycle");
  const { enrichPerformanceBriefWithManualSnapshots } = await import(
    "@/lib/marketing/performance/integration/enrichPerformanceBrief"
  );
  const { buildDailyPerformanceBrief } = await import("@/lib/marketing/cron/buildDailyPerformanceBrief");
  const { getDailyMarketingOperationsStatus } = await import("@/lib/marketing/operations");
  const { OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10, PUBLICATION_FLOW_INACTIVE } = await import(
    "@/lib/marketing/social/publication/governanceBoundary"
  );

  const logicalRunKey = buildLogicalDailyRunKey({ routineId: ROUTINE_ID, businessDateKst: BUSINESS_DATE });
  const now = new Date("2099-01-15T01:00:00.000Z");
  const perfRepo = await createContentPerformanceRepository({ backend: "supabase" });
  const researchRepo = await createResearchRepository({ backend: "supabase" });
  const runRepo = await createDailyMarketingRunRepository({ backend: "supabase" });

  await perfRepo.save({
    snapshot: {
      collectionId: "pcol_step_3_10_probe",
      logicalObservationKey: `step-3-10-verification:${BUSINESS_DATE}:obs-1`,
      candidateId: "cmc_step_3_10_verification",
      humanReviewId: "hmr_step_3_10_verification",
      platform: "threads",
      channel: "threads",
      publicationSource: "manual",
      contentOrigin: "human_edited",
      collectionStatus: "success",
      observedAt: now.toISOString(),
      dataAvailability: "available",
      topic: "[VERIFICATION] STEP 3-10 operations probe",
    },
    metrics: [{ metricType: "impressions", metricValue: 120 }],
  });

  const researchCycle = await runResearchCollectionCycle({
    repo: researchRepo,
    performanceRepo: perfRepo,
    collectors: [],
    now,
    env: { RESEARCH_COLLECTION_ENABLED: "true" },
  });

  const brief = await buildDailyPerformanceBrief({ now });
  const snapshots = await perfRepo.listRecent({ since: "2099-01-01T00:00:00.000Z", limit: 10 });
  const enriched = enrichPerformanceBriefWithManualSnapshots(brief, snapshots);

  const operations = await getDailyMarketingOperationsStatus(
    { businessDateKst: BUSINESS_DATE, now, includeVerification: true },
    { checkSemanticInfrastructure: async () => false },
  );

  console.log(
    JSON.stringify(
      {
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        operationsExternalSideEffects: OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10,
        isolatedLogicalRunKey: logicalRunKey,
        researchCycleStatus: researchCycle.status,
        performanceSnapshotsLoaded: researchCycle.totals.performanceSnapshots,
        paManualMetrics: enriched.confirmedMetrics.filter((m) => m.metricType.startsWith("manual_")).length,
        operationsOverallStatus: operations.overallStatus,
        verificationExcludedFromProductionView: operations.candidate.candidateId !== "cmc_step_3_10_verification",
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
