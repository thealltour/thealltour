#!/usr/bin/env node
/**
 * Cron script: Daily Marketing Plan (task-only, no SNS publish).
 *
 * Reads latest Performance Brief artifact (safe fallback if missing),
 * then runs the daily agenda-slate job (Research → cooldown → human-gated slate).
 * Production (CS/GA/candidate) does NOT start until a later human selection step.
 *
 *   npx tsx scripts/cron-daily-marketing-plan.ts
 *
 * Manual acceptance only (optional):
 *   npx tsx scripts/cron-daily-marketing-plan.ts \
 *     --acceptance-run-key daily-marketing-plan:acceptance:2026-09-04:agenda-v1
 *
 * Feature flag (default off):
 *   AI_RUNTIME_MARKETING_CRON_ENABLED=true
 *
 * IMPORTANT: Install the server-only stub BEFORE any marketing/ai-runtime imports.
 * Static ESM imports are hoisted and would bypass Module._resolveFilename — use
 * dynamic import() inside main() (same pattern as generate-marketing-subtitles.ts).
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

async function main() {
  const { loadLocalEnv } = await import("./loadLocalEnv");
  loadLocalEnv();

  const { buildRuntimeStatus } = await import("../src/ai-runtime/observability/runtime-status");
  const { getDefaultRoutingLedger } = await import("../src/ai-runtime/router");
  const {
    createRuntimeExecutorStack,
    peekRuntimeExecutorStackObservability,
  } = await import("../src/ai-runtime/integration/runtime-stack");
  const { ensureSharedObservabilityRecorder } = await import(
    "../src/ai-runtime/observability/persistence"
  );
  const { runDailyMarketingAgendaSlate } = await import(
    "../src/lib/marketing/cron/daily/runDailyMarketingAgendaSlate"
  );
  const { createDailyMarketingRunRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createDailyAgendaSlateRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository"
  );
  const { buildLogicalDailyRunKey, formatKstBusinessDate } = await import(
    "../src/lib/marketing/cron/daily/kstBusinessDate"
  );
  const { assertAcceptanceLogicalRunKey } = await import(
    "../src/lib/marketing/cron/daily/acceptanceLogicalRunKey"
  );
  const { DAILY_MARKETING_ROUTINE_ID } = await import("../src/lib/marketing/cron/daily/types");
  const { PUBLICATION_FLOW_INACTIVE, SNS_SIDE_EFFECTS_STEP_3_7 } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );
  const {
    createMarketingCronCorrelationId,
    createMarketingManagerAgendaDispatch,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const {
    MARKETING_CRON_HERMES_TIMEOUT_MS,
    MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
  } = await import("../src/lib/marketing/cron/marketingPlanSpecialists");
  const {
    assertHermesSpawnSyncSuccess,
    resolveMarketingCronHermesTimeoutMs,
  } = await import("../src/lib/marketing/cron/hermesSpawnFailure");
  const {
    defaultPerformanceBriefAbsolutePath,
    formatDailyPerformanceBriefMarkdown,
    readLatestPerformanceBrief,
  } = await import("../src/lib/marketing/cron/performanceBriefArtifact");

  function invokeHermesProfile(profile: string, prompt: string): string {
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    const result = spawnSync("hermes", ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
      encoding: "utf8",
      env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes" },
      timeout: timeoutMs,
    });
    return assertHermesSpawnSyncSuccess(profile, result, timeoutMs);
  }

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
    console.log(
      JSON.stringify(
        {
          summary: status.summary,
          scheduler: status.scheduler,
          routing: status.routing,
          providers: status.providers.map((provider) => ({
            id: provider.id,
            quota: provider.quota,
          })),
        },
        null,
        2,
      ),
    );
    console.log("");
  }

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
  const acceptanceRunKeyRaw = argValue(argv, "--acceptance-run-key");
  const acceptanceLogicalRunKey = acceptanceRunKeyRaw
    ? assertAcceptanceLogicalRunKey(acceptanceRunKeyRaw)
    : undefined;
  const logicalRunKey =
    acceptanceLogicalRunKey ??
    buildLogicalDailyRunKey({
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
  console.log(
    `- acceptanceRunKeyOverride: ${acceptanceLogicalRunKey ? "yes" : "no"}`,
  );
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

  if (useRuntime) {
    await ensureSharedObservabilityRecorder();
  }

  const runtimeExecutor = useRuntime ? createRuntimeExecutorStack() : undefined;
  const managerDispatch = createMarketingManagerAgendaDispatch({
    useRuntime,
    correlationId,
    executor: runtimeExecutor,
    invokeHermesProfile: useRuntime ? undefined : invokeHermesProfile,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });

  const repo = await createDailyMarketingRunRepository();
  const slateRepo = await createDailyAgendaSlateRepository();

  const pipelineResult = await runDailyMarketingAgendaSlate(
    {
      productId,
      channel,
      goal,
      businessDateKst,
      ...(acceptanceLogicalRunKey ? { logicalRunKey: acceptanceLogicalRunKey } : {}),
      correlationId,
      performanceNote,
      memoryReferences: brief?.managerEvidence ?? [],
    },
    {
      repo,
      slateRepo,
      invokeManagerProfile: managerDispatch.invokeManagerProfile,
    },
  );

  const slate = pipelineResult.slate ?? null;
  const run = pipelineResult.run;

  console.log("## Daily Agenda Slate Result");
  console.log("");
  console.log(`- idempotent: ${pipelineResult.idempotent}`);
  console.log(`- runStatus: ${run.status}`);
  console.log(`- researchStatus: ${run.researchStatus ?? "none"}`);
  console.log(`- degraded: ${run.degraded}`);
  console.log(`- mode: ${String(run.metadata?.mode ?? "agenda_slate")}`);
  const semanticMeta = run.metadata?.semanticSoftDemotion as
    | { mode?: string; appliedDemotedCount?: number; hypotheticalDemotedCount?: number }
    | undefined;
  if (semanticMeta) {
    console.log(`- semanticDemotionMode: ${semanticMeta.mode ?? "unknown"}`);
    console.log(`- semanticAppliedDemotedCount: ${semanticMeta.appliedDemotedCount ?? 0}`);
    console.log(`- semanticHypotheticalDemotedCount: ${semanticMeta.hypotheticalDemotedCount ?? 0}`);
  }
  console.log(`- agendaSlateId: ${slate?.slateId ?? run.metadata?.agendaSlateId ?? "none"}`);
  console.log(`- slateStatus: ${slate?.status ?? "none"}`);
  console.log(`- slateSize: ${slate?.candidates.length ?? 0}`);
  console.log(`- curationMode: ${slate?.curation.mode ?? run.metadata?.curationMode ?? "none"}`);
  console.log(`- completedCandidateId: ${run.completedCandidateId ?? "none"}`);
  console.log(`- failureReason: ${run.failureReason ?? "none"}`);
  console.log("");

  if (run.failureReason && !slate) {
    console.log("## Slate Stopped");
    console.log("");
    console.log(`Human boundary preserved. Reason: ${run.failureReason}`);
    console.log("No Content Strategy / draft / governance / Human Review bootstrap ran.");
    console.log("");
    logOpsRuntimeTelemetry(useRuntime);
    return;
  }

  if (!slate) {
    throw new Error("expected daily agenda slate");
  }

  if (pipelineResult.candidate) {
    throw new Error("slate-only cron must not create a CompletedMarketingCandidate");
  }

  console.log("## Agenda Slate Candidates");
  console.log("");
  for (const [index, item] of slate.candidates.entries()) {
    console.log(
      `${index + 1}. [${item.state}/${item.origin}] ${item.title} (score=${item.score ?? "n/a"}; ac=${item.agendaCandidateId ?? "none"})`,
    );
  }
  console.log("");

  console.log("## Human Selection Boundary");
  console.log("");
  console.log("- DailyAgendaSlate persisted — production NOT started");
  console.log("- No Content Strategy / Draft / Governance / HumanReview bootstrap");
  console.log("- Downstream production starts only after human SELECTED_TODAY + durable production request");
  console.log("- publish: forbidden");
  console.log("");

  logOpsRuntimeTelemetry(useRuntime);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`daily marketing plan failed: ${message}`);
  process.exit(1);
});
