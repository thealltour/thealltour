#!/usr/bin/env node
/**
 * Pi one-shot worker: claim + process durable marketing production requests.
 *
 * Does NOT publish SNS. Stops at CompletedMarketingCandidate + Human Review bootstrap.
 *
 *   npx tsx scripts/process-marketing-production-queue.ts --dry-run
 *   npx tsx scripts/process-marketing-production-queue.ts --max-batch 3
 *
 * Do NOT point this at production requests you do not intend to produce.
 * Prefer --dry-run first.
 *
 * NOTE: All app imports are dynamic and run AFTER the server-only stub is
 * installed. G7-F1 hydration pulls `import "server-only"` into the executor
 * graph; hoisted static imports would bypass the stub.
 */
import { createRequire } from "node:module";

import { loadLocalEnv } from "./loadLocalEnv";

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

loadLocalEnv();

const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main() {
  const {
    createDefaultProductionExecutor,
    defaultProductionWorkerId,
    processMarketingProductionQueue,
  } = await import("../src/lib/marketing/cron/daily/agendaSlate/processMarketingProductionQueue");
  const {
    DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
    DEFAULT_PRODUCTION_WORKER_MAX_BATCH,
  } = await import("../src/lib/marketing/cron/daily/agendaSlate/productionRequestTypes");
  const { createMarketingProductionRequestRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository"
  );
  const { createDailyMarketingRunRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createHumanMarketingReviewRepository } = await import(
    "../src/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const {
    createMarketingCronCorrelationId,
    createMarketingPlanPipelineDispatch,
    createAudienceResearchInvoke,
    createPublishableComposerInvoke,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const {
    MARKETING_CRON_HERMES_TIMEOUT_MS,
    MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
  } = await import("../src/lib/marketing/cron/marketingPlanSpecialists");
  const { invokeHermesProfileWithRetry, resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { resolveHermesExecutable } = await import(
    "../src/lib/marketing/cron/resolveHermesExecutable"
  );
  const { formatMarketingCronEnvironmentLines, inspectMarketingCronEnvironment } = await import(
    "../src/lib/marketing/cron/marketingCronEnvironment"
  );
  const { createRuntimeExecutorStack } = await import("../src/ai-runtime/integration/runtime-stack");
  const { ensureSharedObservabilityRecorder } = await import(
    "../src/ai-runtime/observability/persistence"
  );
  const { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_7 } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );

  async function invokeHermesProfile(profile: string, prompt: string): Promise<string> {
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    return invokeHermesProfileWithRetry({
      hermesBin: resolveHermesExecutable(process.env),
      profile,
      prompt,
      timeoutMs,
      onRetry: (attempt) => {
        console.error(
          `[hermes-retry] ${attempt.profile} attempt ${attempt.attempt}/${attempt.maxAttempts} failed (${attempt.message}); retrying in ${attempt.delayMs}ms`,
        );
      },
    });
  }

  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run") || hasFlag(argv, "--inspect");
  const maxBatchRaw = Number(argValue(argv, "--max-batch") ?? DEFAULT_PRODUCTION_WORKER_MAX_BATCH);
  const maxBatch = Number.isFinite(maxBatchRaw)
    ? Math.min(Math.max(1, Math.trunc(maxBatchRaw)), DEFAULT_PRODUCTION_WORKER_MAX_BATCH)
    : DEFAULT_PRODUCTION_WORKER_MAX_BATCH;
  const staleAfterMs = Number(
    argValue(argv, "--stale-after-ms") ?? DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS,
  );
  const workerId = argValue(argv, "--worker-id") ?? defaultProductionWorkerId();
  const productId =
    argValue(argv, "--product-id") ?? process.env.MARKETING_CRON_PRODUCT_ID ?? DEFAULT_PRODUCT;
  const channel = argValue(argv, "--channel") ?? process.env.MARKETING_CRON_CHANNEL ?? "threads";
  const backend = argValue(argv, "--backend") === "memory" ? "memory" : undefined;

  console.log("# Marketing Production Queue Worker");
  console.log("");
  console.log(`- dryRun: ${dryRun}`);
  console.log(`- workerId: ${workerId}`);
  console.log(`- maxBatch: ${maxBatch}`);
  console.log(`- staleAfterMs: ${staleAfterMs}`);
  console.log(`- productId: ${productId}`);
  console.log(`- channel: ${channel}`);
  for (const line of formatMarketingCronEnvironmentLines(
    inspectMarketingCronEnvironment({
      entryPoint: "process-marketing-production-queue",
      fallbackTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    }),
  )) {
    console.log(line);
  }
  console.log(`- publication_flow_inactive: ${PUBLICATION_FLOW_INACTIVE}`);
  console.log(`- sns_side_effect: ${SNS_SIDE_EFFECTS_STEP_3_7}`);
  console.log(`- publish: forbidden`);
  console.log("");

  const productionRequestRepo = await createMarketingProductionRequestRepository(
    backend ? { backend } : {},
  );
  const runRepo = await createDailyMarketingRunRepository(backend ? { backend } : {});
  const { createDailyAgendaSlateRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository"
  );
  const slateRepo = await createDailyAgendaSlateRepository(backend ? { backend } : {});

  if (dryRun) {
    const result = await processMarketingProductionQueue({
      dryRun: true,
      maxBatch,
      staleAfterMs,
      workerId,
      deps: {
        productionRequestRepo,
        runRepo,
        slateRepo,
        reviewRepo: await createHumanMarketingReviewRepository(backend ? { backend } : {}),
        executeProduction: async () => {
          throw new Error("dry-run must not execute production");
        },
      },
    });
    console.log("## Claimable (no mutations)");
    console.log("");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  const correlationId = createMarketingCronCorrelationId();
  if (useRuntime) {
    await ensureSharedObservabilityRecorder();
  }
  const runtimeExecutor = useRuntime ? createRuntimeExecutorStack() : undefined;
  const dispatchOptions = {
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  };
  const dispatch = createMarketingPlanPipelineDispatch(dispatchOptions);
  const invokeAudienceResearch = createAudienceResearchInvoke(dispatchOptions);
  const invokePublishableComposer = createPublishableComposerInvoke(dispatchOptions);
  const reviewRepo = await createHumanMarketingReviewRepository(backend ? { backend } : {});

  const executeProduction = createDefaultProductionExecutor({
    productId,
    channel,
    pipelineDeps: {
      repo: runRepo,
      reviewRepo,
      productionRequestRepo,
      ...dispatch,
      invokeAudienceResearch,
      invokePublishableComposer,
      // Exact slate selection is supplied per request — never rediscover via MM.
      requestPerformance: async () => ({
        unavailable: true as const,
        reason: "production_queue_worker_no_perf_brief",
      }),
    },
  });

  const result = await processMarketingProductionQueue({
    dryRun: false,
    maxBatch,
    staleAfterMs,
    workerId,
    deps: {
      productionRequestRepo,
      runRepo,
      slateRepo,
      reviewRepo,
      executeProduction,
    },
  });

  console.log("## Worker Result");
  console.log("");
  console.log(JSON.stringify(result, null, 2));
  console.log("");
  console.log("- Human Review boundary preserved (no SNS publish)");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`production queue worker failed: ${message}`);
  process.exit(1);
});
