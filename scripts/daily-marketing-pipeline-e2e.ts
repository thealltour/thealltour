#!/usr/bin/env node
/**
 * Controlled manual E2E for STEP 3-7 daily marketing pipeline.
 * Uses the same runDailyMarketingPipeline path as cron-daily-marketing-plan.ts
 * with in-memory persistence by default (no SNS, no publication).
 *
 *   npx tsx scripts/daily-marketing-pipeline-e2e.ts
 *   npx tsx scripts/daily-marketing-pipeline-e2e.ts --backend supabase
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

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
import { runDailyMarketingPipeline } from "../src/lib/marketing/cron/daily/runDailyMarketingPipeline";
import { createDailyMarketingRunRepository } from "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { formatKstBusinessDate, buildLogicalDailyRunKey } from "../src/lib/marketing/cron/daily/kstBusinessDate";
import { DAILY_MARKETING_ROUTINE_ID } from "../src/lib/marketing/cron/daily/types";
import {
  createMarketingCronCorrelationId,
  createMarketingManagerAgendaDispatch,
  createMarketingPlanPipelineDispatch,
  isAiRuntimeMarketingCronEnabled,
} from "../src/lib/marketing/cron/marketingCronRuntime";
import { MARKETING_CRON_HERMES_TIMEOUT_MS } from "../src/lib/marketing/cron/marketingPlanSpecialists";
import { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_7 } from "../src/lib/marketing/social/publication/governanceBoundary";
import {
  createRuntimeExecutorStack,
} from "../src/ai-runtime/integration/runtime-stack";
import { ensureSharedObservabilityRecorder } from "../src/ai-runtime/observability/persistence";

const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function invokeHermesProfile(profile: string, prompt: string): string {
  const result = spawnSync("hermes", ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
    encoding: "utf8",
    env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
    timeout: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });
  if (result.status !== 0) {
    throw new Error(`${profile} exited ${result.status}: ${(result.stderr || result.stdout || "").slice(0, 400)}`);
  }
  return result.stdout ?? "";
}

async function main() {
  const argv = process.argv.slice(2);
  const productId = argValue(argv, "--product-id") ?? process.env.MARKETING_CRON_PRODUCT_ID ?? DEFAULT_PRODUCT;
  const channel = argValue(argv, "--channel") ?? "threads";
  const backend = argValue(argv, "--backend") === "supabase" ? "supabase" : "memory";
  const useRuntime = isAiRuntimeMarketingCronEnabled();
  const correlationId = createMarketingCronCorrelationId();
  const businessDateKst = formatKstBusinessDate();
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst,
  });

  if (useRuntime) {
    await ensureSharedObservabilityRecorder();
  }
  const runtimeExecutor = useRuntime ? createRuntimeExecutorStack() : undefined;

  console.log("# Daily Marketing Pipeline E2E");
  console.log(JSON.stringify({
    productId,
    channel,
    backend,
    useRuntime,
    correlationId,
    businessDateKst,
    logicalRunKey,
    publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
    snsSideEffects: SNS_SIDE_EFFECTS_STEP_3_7,
  }, null, 2));

  const dispatch = createMarketingPlanPipelineDispatch({
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });
  const managerDispatch = createMarketingManagerAgendaDispatch({
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });

  const repo = await createDailyMarketingRunRepository({ backend });

  const first = await runDailyMarketingPipeline(
    { productId, channel, businessDateKst, correlationId },
    {
      repo,
      ...dispatch,
      invokeManagerProfile: managerDispatch.invokeManagerProfile,
      requestPerformance: async () => ({ unavailable: true, reason: "e2e" }),
    },
  );

  const second = await runDailyMarketingPipeline(
    { productId, channel, businessDateKst, correlationId: `${correlationId}:retry` },
    {
      repo,
      ...dispatch,
      invokeManagerProfile: managerDispatch.invokeManagerProfile,
      requestPerformance: async () => ({ unavailable: true, reason: "e2e" }),
    },
  );

  console.log("## First Run");
  console.log(JSON.stringify({
    idempotent: first.idempotent,
    runStatus: first.run.status,
    researchStatus: first.run.researchStatus,
    failureReason: first.run.failureReason,
    candidateId: first.candidate?.candidateId ?? null,
    candidateStatus: first.candidate?.status ?? null,
    assignmentId: first.run.assignmentId,
    revisionCount: first.run.observability.revisionCount,
  }, null, 2));

  console.log("## Idempotent Rerun");
  console.log(JSON.stringify({
    idempotent: second.idempotent,
    runStatus: second.run.status,
    sameCandidate: first.candidate?.candidateId === second.candidate?.candidateId,
  }, null, 2));

  if (second.candidate) {
    console.log("E2E PASS — CompletedMarketingCandidate persisted.");
    console.log(JSON.stringify({
      candidateId: second.candidate.candidateId,
      status: second.candidate.status,
      assignmentId: second.candidate.contentAssignment.assignmentId,
      governanceDecision: second.candidate.governanceDecision?.decision ?? null,
      idempotentRerun: second.idempotent,
    }, null, 2));
  } else if (first.candidate) {
    console.log("E2E PASS — CompletedMarketingCandidate persisted once.");
  } else if (first.run.failureReason) {
    console.log(`E2E STOPPED SAFELY — ${first.run.failureReason}`);
  } else {
    throw new Error("unexpected e2e outcome");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
