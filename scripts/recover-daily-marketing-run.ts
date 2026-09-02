#!/usr/bin/env node
/**
 * Safe operator recovery for a failed daily marketing run.
 *   npx tsx scripts/recover-daily-marketing-run.ts --businessDate=2026-09-02 --dry-run
 *   npx tsx scripts/recover-daily-marketing-run.ts --businessDate=2026-09-02 --execute
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

function parseArgs(argv: string[]) {
  const businessDate = argv.find((arg) => arg.startsWith("--businessDate="))?.split("=")[1] ?? null;
  const dryRun = argv.includes("--dry-run");
  const execute = argv.includes("--execute");
  return { businessDate, dryRun, execute };
}

async function main() {
  const { businessDate, dryRun, execute } = parseArgs(process.argv.slice(2));
  if (!businessDate) {
    console.error("Usage: recover-daily-marketing-run.ts --businessDate=YYYY-MM-DD [--dry-run|--execute]");
    process.exit(1);
  }
  if (dryRun === execute) {
    console.error("Specify exactly one of --dry-run or --execute");
    process.exit(1);
  }

  const { buildLogicalDailyRunKey } = await import("@/lib/marketing/cron/daily/kstBusinessDate");
  const { DAILY_MARKETING_ROUTINE_ID } = await import("@/lib/marketing/cron/daily/types");
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { classifyMarketingIncident } = await import("@/lib/marketing/operations/incidentClassification");
  const { OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10, PUBLICATION_FLOW_INACTIVE } = await import(
    "@/lib/marketing/social/publication/governanceBoundary"
  );

  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst: businessDate,
  });
  const repo = await createDailyMarketingRunRepository({ backend: "supabase" });
  const existingRun = await repo.findRunByLogicalKey(logicalRunKey);
  const existingCandidate = await repo.findCandidateByLogicalKey(logicalRunKey);

  if (existingCandidate) {
    console.log(
      JSON.stringify(
        {
          action: "refused",
          reason: "production_candidate_already_exists",
          candidateId: existingCandidate.candidateId,
          candidateStatus: existingCandidate.status,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (!existingRun) {
    console.log(JSON.stringify({ action: "refused", reason: "no_run_for_business_date", logicalRunKey }, null, 2));
    process.exit(1);
  }

  if (existingRun.status === "started") {
    console.log(JSON.stringify({ action: "refused", reason: "ambiguous_in_progress_run", runId: existingRun.runId }, null, 2));
    process.exit(1);
  }

  if (existingRun.status === "completed" && existingRun.completedCandidateId) {
    console.log(
      JSON.stringify(
        {
          action: "refused",
          reason: "run_already_completed",
          runId: existingRun.runId,
          completedCandidateId: existingRun.completedCandidateId,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const incident = classifyMarketingIncident({
    failureReason: existingRun.failureReason,
    pipelineFailureCode: (existingRun.metadata.pipelineFailure as { code?: string } | undefined)?.code ?? null,
    pipelineFailureMessage:
      (existingRun.metadata.pipelineFailure as { message?: string } | undefined)?.message ?? null,
    revisionCount: existingRun.observability.revisionCount,
    governanceReviewId: existingRun.governanceReviewId,
  });

  const plan = {
    action: dryRun ? "dry_run" : "execute_recovery",
    businessDateKst: businessDate,
    logicalRunKey,
    priorRunId: existingRun.runId,
    priorFailureReason: existingRun.failureReason,
    nextExecutionAttempt: (existingRun.executionAttempt ?? 1) + 1,
    incident,
    publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
    operationsExternalSideEffects: OPERATIONS_EXTERNAL_SIDE_EFFECTS_STEP_3_10,
    note: "No SNS publish. Original failed run preserved in metadata.incidentHistory.",
  };

  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) return;

  const { runDailyMarketingPipeline } = await import("../src/lib/marketing/cron/daily/runDailyMarketingPipeline");
  const { createMarketingCronCorrelationId, createMarketingPlanPipelineDispatch, createMarketingManagerAgendaDispatch, isAiRuntimeMarketingCronEnabled } =
    await import("../src/lib/marketing/cron/marketingCronRuntime");
  const { createRuntimeExecutorStack } = await import("../src/ai-runtime/integration/runtime-stack");
  const { readLatestPerformanceBrief, defaultPerformanceBriefAbsolutePath } = await import(
    "../src/lib/marketing/cron/performanceBriefArtifact"
  );
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const useRuntime = isAiRuntimeMarketingCronEnabled();
  const correlationId = createMarketingCronCorrelationId();
  const brief = readLatestPerformanceBrief(defaultPerformanceBriefAbsolutePath(ROOT));
  const runtimeExecutor = useRuntime ? createRuntimeExecutorStack() : undefined;
  const dispatch = createMarketingPlanPipelineDispatch({
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: undefined,
    completionTimeoutMs: 180_000,
  });
  const managerDispatch = createMarketingManagerAgendaDispatch({
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: undefined,
    completionTimeoutMs: 180_000,
  });

  const result = await runDailyMarketingPipeline(
    {
      productId: process.env.MARKETING_CRON_PRODUCT_ID ?? "98a889e9-fbc4-41e3-8302-0d2b042fbe0a",
      channel: process.env.MARKETING_CRON_CHANNEL ?? "threads",
      businessDateKst: businessDate,
      correlationId,
      executionAttempt: plan.nextExecutionAttempt,
      recoveryMode: true,
    },
    {
      repo,
      ...dispatch,
      invokeManagerProfile: managerDispatch.invokeManagerProfile,
      requestPerformance: async () =>
        brief
          ? {
              period: brief.period,
              productId: brief.productId,
              channel: brief.channel,
              keyMetrics: brief.confirmedMetrics.filter((m) => m.value > 0).map((m) => ({
                metricType: m.metricType,
                value: m.value,
              })),
              observedPatterns: [...brief.managerEvidence, ...brief.notableChanges],
              confidence: brief.dataAvailability === "available" ? "medium" : "low",
            }
          : { unavailable: true, reason: "latest_performance_brief_missing" },
    },
  );

  console.log(
    JSON.stringify(
      {
        recoveryResult: {
          idempotent: result.idempotent,
          runStatus: result.run.status,
          failureReason: result.run.failureReason,
          completedCandidateId: result.run.completedCandidateId,
          candidateStatus: result.candidate?.status ?? null,
          incidentHistoryCount: Array.isArray(result.run.metadata.incidentHistory)
            ? result.run.metadata.incidentHistory.length
            : 0,
        },
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
