#!/usr/bin/env node
/**
 * STEP 3-9 production-equivalent internal E2E against remote Supabase.
 *   npx tsx scripts/performance-feedback-production-e2e-probe.ts
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

const LOGICAL_KEY = "step-3-9-verification:2026-09-02:obs-1";

async function main() {
  const { createContentPerformanceRepository } = await import(
    "../src/lib/marketing/performance/repository/createContentPerformanceRepository"
  );
  const { createResearchRepository } = await import(
    "@/lib/marketing/research/repository/createResearchRepository"
  );
  const { runResearchCollectionCycle } = await import(
    "@/lib/marketing/research/collection/runResearchCollectionCycle"
  );
  const { getMarketingManagerResearchContext } = await import(
    "@/lib/marketing/research/manager/getMarketingManagerResearchContext"
  );
  const { buildDailyPerformanceBrief } = await import("@/lib/marketing/cron/buildDailyPerformanceBrief");
  const { enrichPerformanceBriefWithManualSnapshots } = await import(
    "@/lib/marketing/performance/integration/enrichPerformanceBrief"
  );
  const { performanceSnapshotExternalId } = await import("@/lib/marketing/performance/constants");
  const { PUBLICATION_FLOW_INACTIVE, PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9, SNS_SIDE_EFFECTS_STEP_3_8 } =
    await import("@/lib/marketing/social/publication/governanceBoundary");

  const perfRepo = await createContentPerformanceRepository({ backend: "supabase" });
  const repo = await createResearchRepository({ backend: "supabase" });
  const now = new Date("2026-09-02T08:30:00.000Z");

  const snapshotsBefore = await perfRepo.listRecent({ since: "2026-01-01T00:00:00.000Z", limit: 20 });
  const verification = snapshotsBefore.find((s) => s.logicalObservationKey === LOGICAL_KEY);

  const cycle1 = await runResearchCollectionCycle({
    repo,
    performanceRepo: perfRepo,
    collectors: [],
    now,
    env: { RESEARCH_COLLECTION_ENABLED: "true" },
  });

  const cycle2 = await runResearchCollectionCycle({
    repo,
    performanceRepo: perfRepo,
    collectors: [],
    now: new Date("2026-09-02T09:00:00.000Z"),
    env: { RESEARCH_COLLECTION_ENABLED: "true" },
  });

  const LATER_KEY = "step-3-9-verification:2026-09-02:obs-2";
  let laterSnapshot = await perfRepo.findByLogicalObservationKey(LATER_KEY);
  if (!laterSnapshot) {
    laterSnapshot = (
      await perfRepo.save({
        snapshot: {
          collectionId: "pcol_step_3_9_verification_obs2",
          logicalObservationKey: LATER_KEY,
          candidateId: "cmc_step_3_9_verification",
          humanReviewId: "hmr_step_3_9_verification",
          platform: "threads",
          channel: "threads",
          externalPostId: "verification_post_no_provider_call",
          publishedAt: "2026-09-01T10:00:00.000Z",
          publicationSource: "manual",
          contentOrigin: "human_edited",
          collectionStatus: "success",
          observedAt: "2026-09-02T12:00:00.000Z",
          dataAvailability: "available",
          topic: "[VERIFICATION] STEP 3-9 performance feedback wiring (later obs)",
          destinations: ["japan"],
          format: "thread",
          commercialIntent: "awareness",
          productLinked: false,
          sampleQuality: "single_post_sample",
          reason: null,
          normalizedMetrics: { engagementRate: 0.052, ageHoursAtObservation: 26 },
        },
        metrics: [
          { metricType: "impressions", metricValue: 720 },
          { metricType: "likes", metricValue: 31 },
        ],
      })
    ).snapshot;
  }

  const cycle3 = await runResearchCollectionCycle({
    repo,
    performanceRepo: perfRepo,
    collectors: [],
    now: new Date("2026-09-02T13:00:00.000Z"),
    env: { RESEARCH_COLLECTION_ENABLED: "true" },
  });

  const signals = await repo.findRecentSignals({ since: "2026-01-01T00:00:00.000Z", limit: 500 });
  const perfSignals = signals.filter((s) => s.signalType === "content_performance");
  const verificationSignals = verification
    ? perfSignals.filter((s) => s.externalId === performanceSnapshotExternalId(verification.snapshotId))
    : [];
  const laterSignals = laterSnapshot
    ? perfSignals.filter((s) => s.externalId === performanceSnapshotExternalId(laterSnapshot.snapshotId))
    : [];

  const mmContextNow = new Date("2026-09-02T13:30:00.000Z");

  const mmContext = await getMarketingManagerResearchContext(
    { lookbackHours: 168 },
    { repo, now: mmContextNow, checkSemanticInfrastructure: async () => false },
  );

  const mmContextTopicFiltered = await getMarketingManagerResearchContext(
    { lookbackHours: 168, topic: "performance" },
    { repo, now: mmContextNow, checkSemanticInfrastructure: async () => false },
  );

  const verificationSignal = verificationSignals[0] ?? null;

  const brief = await buildDailyPerformanceBrief({ now });
  const enriched = enrichPerformanceBriefWithManualSnapshots(
    brief,
    await perfRepo.listRecent({ since: "2026-01-01T00:00:00.000Z", limit: 20 }),
  );

  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { count: socialPubCount } = await supabaseAdmin
    .from("social_publications")
    .select("*", { count: "exact", head: true });

  console.log(
    JSON.stringify(
      {
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        performanceCollectionSideEffects: PERFORMANCE_COLLECTION_SIDE_EFFECTS_STEP_3_9,
        snsSideEffectsStep38: SNS_SIDE_EFFECTS_STEP_3_8,
        verificationSnapshotFound: Boolean(verification),
        verificationSnapshotId: verification?.snapshotId ?? null,
        contentOrigin: verification?.contentOrigin ?? null,
        cycle1: {
          performanceSnapshots: cycle1.totals.performanceSnapshots,
          performanceFeedbackStatus: cycle1.totals.performanceFeedbackStatus,
          accepted: cycle1.totals.accepted,
        },
        cycle2Idempotent: {
          performanceSnapshots: cycle2.totals.performanceSnapshots,
          verificationSignalCount: verificationSignals.length,
        },
        cycle3TimeSeries: {
          performanceSnapshots: cycle3.totals.performanceSnapshots,
          laterObservationSignalCount: laterSignals.length,
          distinctVerificationSignals:
            verificationSignals.length >= 1 && laterSignals.length >= 1
              ? verificationSignals[0]?.id !== laterSignals[0]?.id
              : false,
        },
        mmContext: {
          status: mmContext.status,
          briefCount: mmContext.briefs.length,
          hasContentPerformanceBrief: mmContext.briefs.some((b) => b.signalTypes.includes("content_performance")),
        },
        mmContextTopicFiltered: {
          status: mmContextTopicFiltered.status,
          briefCount: mmContextTopicFiltered.briefs.length,
          hasContentPerformanceBrief: mmContextTopicFiltered.briefs.some((b) =>
            b.signalTypes.includes("content_performance"),
          ),
          advisoryEvidence: mmContextTopicFiltered.briefs.some((b) =>
            b.evidence.some((ev) => ev.evidenceType === "internal_record"),
          ),
        },
        persistedPerformanceSignal: verificationSignal
          ? {
              externalId: verificationSignal.externalId,
              contentOrigin: (verificationSignal.metadata as { contentOrigin?: string } | undefined)?.contentOrigin ?? null,
              sampleQuality:
                (verificationSignal.metadata as { sampleQuality?: string } | undefined)?.sampleQuality ?? null,
              advisoryOnly:
                (verificationSignal.metadata as { advisoryOnly?: boolean } | undefined)?.advisoryOnly ?? null,
            }
          : null,
        paBrief: {
          sourcesChecked: enriched.sourcesChecked,
          manualMetricCount: enriched.confirmedMetrics.filter((m) => m.metricType.startsWith("manual_")).length,
          hasHumanEditedEvidence: enriched.managerEvidence.some((line) => line.includes("origin=human_edited")),
        },
        socialPublications: socialPubCount ?? 0,
        liveProviderRead: "LIVE PROVIDER READ UNEXERCISED",
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
