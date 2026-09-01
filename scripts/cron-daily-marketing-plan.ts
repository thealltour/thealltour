#!/usr/bin/env node
/**
 * Cron script: Daily Marketing Plan (task-only, no SNS publish).
 *
 * Reads latest Performance Brief artifact (safe fallback if missing),
 * then runs the integrated daily marketing pipeline (Research → MM → CS → GA)
 * producing one CompletedMarketingCandidate — no SNS publish.
 *
 *   npx tsx scripts/cron-daily-marketing-plan.ts
 *
 * Feature flag (default off):
 *   AI_RUNTIME_MARKETING_CRON_ENABLED=true
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

import { buildRuntimeStatus } from "../src/ai-runtime/observability/runtime-status";
import { getDefaultRoutingLedger } from "../src/ai-runtime/router";
import {
  createRuntimeExecutorStack,
  peekRuntimeExecutorStackObservability,
} from "../src/ai-runtime/integration/runtime-stack";
import { ensureSharedObservabilityRecorder } from "../src/ai-runtime/observability/persistence";
import { runDailyMarketingPipeline } from "../src/lib/marketing/cron/daily/runDailyMarketingPipeline";
import { createDailyMarketingRunRepository } from "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { buildLogicalDailyRunKey, formatKstBusinessDate } from "../src/lib/marketing/cron/daily/kstBusinessDate";
import { DAILY_MARKETING_ROUTINE_ID } from "../src/lib/marketing/cron/daily/types";
import { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_7 } from "../src/lib/marketing/social/publication/governanceBoundary";
import type { PerformanceBrief, PerformanceUnavailable } from "../src/lib/marketing/bot/organization/handoffs";
import {
  createMarketingCronCorrelationId,
  createMarketingManagerAgendaDispatch,
  createMarketingPlanPipelineDispatch,
  isAiRuntimeMarketingCronEnabled,
} from "../src/lib/marketing/cron/marketingCronRuntime";
import { MARKETING_CRON_HERMES_TIMEOUT_MS } from "../src/lib/marketing/cron/marketingPlanSpecialists";
import {
  defaultPerformanceBriefAbsolutePath,
  formatDailyPerformanceBriefMarkdown,
  readLatestPerformanceBrief,
  type DailyPerformanceBriefArtifact,
} from "../src/lib/marketing/cron/performanceBriefArtifact";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function logOpsRuntimeTelemetry(useRuntime: boolean): void {
  if (!useRuntime || process.env.AI_RUNTIME_OPS_TELEMETRY?.trim() !== "1") return;

  const observability = peekRuntimeExecutorStackObservability();
  const status = buildRuntimeStatus({
    env: process.env,
    now: () => new Date(),
    ledger: observability?.ledger,
    quotaBroker: observability?.quotaBroker,
    scheduler: observability?.scheduler,
    routingLedger: getDefaultRoutingLedger(),
  });

  console.log("## Ops Runtime Telemetry");
  console.log("");
  console.log(JSON.stringify({
    summary: status.summary,
    scheduler: status.scheduler,
    routing: status.routing,
    providers: status.providers.map((provider) => ({
      id: provider.id,
      quota: provider.quota,
    })),
  }, null, 2));
  console.log("");
}

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
    throw new Error(
      `${profile} exited ${result.status}: ${(result.stderr || result.stdout || "").slice(0, 400)}`,
    );
  }
  return result.stdout ?? "";
}

function briefToPipelinePerformance(
  brief: DailyPerformanceBriefArtifact | null,
): PerformanceBrief | PerformanceUnavailable {
  if (!brief) {
    return { unavailable: true, reason: "latest_performance_brief_missing" };
  }
  if (brief.dataAvailability === "unavailable") {
    return { unavailable: true, reason: "performance_data_unavailable" };
  }
  const keyMetrics = brief.confirmedMetrics
    .filter((item) => item.value > 0)
    .map((item) => ({ metricType: item.metricType, value: item.value }));
  if (keyMetrics.length === 0) {
    return { unavailable: true, reason: "no_positive_confirmed_metrics" };
  }
  return {
    period: brief.period,
    productId: brief.productId,
    channel: brief.channel,
    keyMetrics,
    observedPatterns: [...brief.managerEvidence, ...brief.notableChanges],
    confidence: brief.dataAvailability === "available" ? "medium" : "low",
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const productId = argValue(argv, "--product-id") ?? process.env.MARKETING_CRON_PRODUCT_ID ?? DEFAULT_PRODUCT;
  const channel = argValue(argv, "--channel") ?? process.env.MARKETING_CRON_CHANNEL ?? "threads";
  const goal =
    argValue(argv, "--goal") ??
    process.env.MARKETING_CRON_GOAL ??
    "스페인/포르투갈 패키지 홍보 Threads 콘텐츠 (게시 금지)";

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  const correlationId = createMarketingCronCorrelationId();
  const businessDateKst = formatKstBusinessDate();
  const logicalRunKey = buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst,
  });

  const briefPath = defaultPerformanceBriefAbsolutePath(ROOT);
  const brief = readLatestPerformanceBrief(briefPath);
  const performanceNote =
    !brief || brief.dataAvailability === "unavailable"
      ? "성과 데이터가 부족하므로 상품/Context/Memory 근거 중심으로 계획"
      : `성과 brief dataAvailability=${brief.dataAvailability}`;

  console.log("# Daily Marketing Plan");
  console.log("");
  console.log(`- productId: ${productId}`);
  console.log(`- channel: ${channel}`);
  console.log(`- businessDateKst: ${businessDateKst}`);
  console.log(`- logicalRunKey: ${logicalRunKey}`);
  console.log(`- performance handoff: ${brief ? "artifact_read" : "missing_fallback"}`);
  console.log(`- note: ${performanceNote}`);
  console.log(`- inference_path: ${useRuntime ? "ai-runtime" : "hermes-cli"}`);
  console.log(`- correlationId: ${correlationId}`);
  console.log(`- publication_flow_inactive: ${PUBLICATION_FLOW_INACTIVE}`);
  console.log(`- sns_side_effect: ${SNS_SIDE_EFFECTS_STEP_3_7}`);
  console.log(`- publish: forbidden`);
  console.log("");

  if (brief) {
    console.log("## Attached Performance Brief");
    console.log("");
    console.log(formatDailyPerformanceBriefMarkdown(brief));
  } else {
    console.log("## Attached Performance Brief");
    console.log("");
    console.log("- latest brief unavailable — safe fallback");
    console.log("");
  }

  const pipelinePerformance = briefToPipelinePerformance(brief);
  if (useRuntime) {
    await ensureSharedObservabilityRecorder();
  }
  const runtimeExecutor = useRuntime ? createRuntimeExecutorStack() : undefined;

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

  const repo = await createDailyMarketingRunRepository();

  const pipelineResult = await runDailyMarketingPipeline(
    {
      productId,
      channel,
      goal,
      businessDateKst,
      correlationId,
      performanceNote,
      memoryReferences: brief?.managerEvidence ?? [],
    },
    {
      repo,
      ...dispatch,
      invokeManagerProfile: managerDispatch.invokeManagerProfile,
      requestPerformance: async () => pipelinePerformance,
    },
  );

  const result = pipelineResult.candidate;
  const run = pipelineResult.run;

  console.log("## Daily Pipeline Result");
  console.log("");
  console.log(`- idempotent: ${pipelineResult.idempotent}`);
  console.log(`- runStatus: ${run.status}`);
  console.log(`- researchStatus: ${run.researchStatus ?? "none"}`);
  console.log(`- degraded: ${run.degraded}`);
  console.log(`- selectedAgendaId: ${run.selectedAgendaId ?? "none"}`);
  console.log(`- assignmentId: ${run.assignmentId ?? "none"}`);
  console.log(`- governanceReviewId: ${run.governanceReviewId ?? "none"}`);
  console.log(`- completedCandidateId: ${run.completedCandidateId ?? "none"}`);
  console.log(`- failureReason: ${run.failureReason ?? "none"}`);
  console.log(`- finalStatus: ${result?.status ?? "none"}`);
  console.log(`- revisionCount: ${run.observability.revisionCount}`);
  console.log(`- governanceDecision: ${result?.governanceDecision?.decision ?? "none"}`);
  console.log("");

  if (run.failureReason && !result) {
    console.log("## Pipeline Stopped Before Candidate");
    console.log("");
    console.log(`Human boundary preserved. Reason: ${run.failureReason}`);
    console.log("");
    logOpsRuntimeTelemetry(useRuntime);
    return;
  }

  if (!result) {
    throw new Error("expected completed marketing candidate");
  }

  console.log("## Completed Marketing Candidate");
  console.log("");
  console.log(`- candidateId: ${result.candidateId}`);
  console.log(`- contract: ${result.contract}`);
  console.log(`- status: ${result.status}`);
  console.log(`- assignmentId: ${result.contentAssignment.assignmentId}`);
  console.log(`- selectedAgenda: ${result.selectedAgenda.title}`);
  console.log("");

  if (result.draft?.body) {
    console.log("## Draft Candidate");
    console.log("");
    if (result.draft.title) console.log(`title: ${result.draft.title}`);
    console.log(result.draft.body);
    console.log("");
  }

  if (result.governanceDecision) {
    console.log("## Governance");
    console.log("");
    console.log(JSON.stringify(result.governanceDecision, null, 2));
    console.log("");
  }

  console.log("## Human Review Boundary");
  console.log("");
  console.log("- CompletedMarketingCandidate persisted — NOT ExternalPublication");
  console.log("- ALLOW → ready_for_human_review (no publish)");
  console.log("- REVIEW → needs_human_review (no publish)");
  console.log("- BLOCK → blocked (no publish)");
  console.log("");
  console.log("Human Owner: review persisted candidate / cron output. STEP 3-8 adds proactive presentation.");

  logOpsRuntimeTelemetry(useRuntime);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`daily marketing plan failed: ${message}`);
  process.exit(1);
});
