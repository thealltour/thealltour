#!/usr/bin/env node
/**
 * STEP 3-10 honest current-day production audit (read-only).
 *   npx tsx scripts/marketing-operations-current-day-audit.ts
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

async function main() {
  const { formatKstBusinessDate } = await import("@/lib/marketing/cron/daily/kstBusinessDate");
  const { getDailyMarketingOperationsStatus, getRecentDailyMarketingOperationsSummaries, OBSERVABILITY_GAPS } =
    await import("@/lib/marketing/operations");
  const { readLatestPerformanceBrief } = await import("@/lib/marketing/cron/performanceBriefArtifact");
  const { isBeforeMarketingRunDue, isBeforePerformanceBriefDue } = await import("@/lib/marketing/operations/healthRules");
  const { OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10, PUBLICATION_FLOW_INACTIVE } = await import(
    "@/lib/marketing/social/publication/governanceBoundary"
  );

  const now = new Date();
  const businessDateKst = formatKstBusinessDate(now);
  const [status, recent] = await Promise.all([
    getDailyMarketingOperationsStatus({ businessDateKst, now }),
    getRecentDailyMarketingOperationsSummaries(7, { now }),
  ]);
  const brief = readLatestPerformanceBrief();

  console.log(
    JSON.stringify(
      {
        auditedAt: now.toISOString(),
        businessDateKst,
        beforePerformanceBriefDue: isBeforePerformanceBriefDue(now, businessDateKst),
        beforeMarketingRunDue: isBeforeMarketingRunDue(now, businessDateKst),
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        operationsExternalSideEffects: OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10,
        performanceArtifact: brief
          ? { generatedAt: brief.generatedAt, dataAvailability: brief.dataAvailability }
          : null,
        today: {
          overallStatus: status.overallStatus,
          performanceBrief: status.performanceBrief,
          research: status.research,
          marketingRun: status.marketingRun,
          candidate: status.candidate,
          humanReview: status.humanReview,
          feedback: status.feedback,
          incident: status.incident,
          actionRequiredReasons: status.actionRequiredReasons,
          trace: status.trace,
        },
        recentSummaries: recent,
        observabilityGaps: OBSERVABILITY_GAPS,
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
