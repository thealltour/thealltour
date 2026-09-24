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
 * Manual recovery (optional):
 *   npx tsx scripts/cron-daily-marketing-plan.ts \
 *     --business-date 2026-09-17 \
 *     --v2-shadow-run-type MANUAL_RERUN
 *
 * Feature flag (default off):
 *   AI_RUNTIME_MARKETING_CRON_ENABLED=true
 *
 * IMPORTANT: Install the server-only stub BEFORE any marketing/ai-runtime imports.
 * Static ESM imports are hoisted and would bypass Module._resolveFilename — use
 * dynamic import() inside main() (same pattern as generate-marketing-subtitles.ts).
 */
import { createRequire } from "node:module";
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
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function assertBusinessDateKst(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`invalid_business_date:${raw}`);
  }
  return raw;
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
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { invokeMarketingHermesAgent } = await import(
    "../src/lib/marketing/hermesRuntime/launcher"
  );
  const { formatMarketingCronEnvironmentLines, inspectMarketingCronEnvironment } = await import(
    "../src/lib/marketing/cron/marketingCronEnvironment"
  );
  const {
    defaultPerformanceBriefAbsolutePath,
    formatDailyPerformanceBriefMarkdown,
    readLatestPerformanceBrief,
  } = await import("../src/lib/marketing/cron/performanceBriefArtifact");

  async function invokeHermesProfile(profile: string, prompt: string): Promise<string> {
    const timeoutMs = resolveMarketingCronHermesTimeoutMs(
      process.env,
      MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    );
    // Single transport-retry owner: unified launcher (contract.transportRetries).
    // Do not wrap again in invokeHermesProfileWithRetry.
    return invokeMarketingHermesAgent({
      profileId: profile,
      prompt,
      timeoutMs,
      withTransportRetry: true,
      onTransportRetry: (attempt) => {
        console.error(
          `[hermes-retry] ${attempt.profile} attempt ${attempt.attempt}/${attempt.maxAttempts} failed (${attempt.message}); retrying in ${attempt.delayMs}ms`,
        );
      },
    });
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
  const businessDateOverride = argValue(argv, "--business-date");
  const businessDateKst = businessDateOverride
    ? assertBusinessDateKst(businessDateOverride)
    : formatKstBusinessDate();
  const v2ShadowRunTypeRaw = (argValue(argv, "--v2-shadow-run-type") ?? "SCHEDULED").trim();
  if (v2ShadowRunTypeRaw !== "SCHEDULED" && v2ShadowRunTypeRaw !== "MANUAL_RERUN") {
    throw new Error(`invalid_v2_shadow_run_type:${v2ShadowRunTypeRaw}`);
  }
  const v2ShadowRunType = v2ShadowRunTypeRaw as "SCHEDULED" | "MANUAL_RERUN";
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
  console.log(`- businessDateOverride: ${businessDateOverride ? "yes" : "no"}`);
  console.log(`- v2ShadowRunType: ${v2ShadowRunType}`);
  console.log(`- logicalRunKey: ${logicalRunKey}`);
  console.log(
    `- acceptanceRunKeyOverride: ${acceptanceLogicalRunKey ? "yes" : "no"}`,
  );
  console.log(`- performance handoff: ${brief ? "artifact_read" : "missing_fallback"}`);
  console.log(`- note: ${performanceNote}`);
  for (const line of formatMarketingCronEnvironmentLines(
    inspectMarketingCronEnvironment({
      entryPoint: "cron-daily-marketing-plan",
      fallbackTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
    }),
  )) {
    console.log(line);
  }
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

  const { isAgendaQualityV2ShadowEnabled } = await import(
    "../src/lib/marketing/agendaQualityV2/shadow/config"
  );
  let agendaQualityV2Shadow:
    | import("../src/lib/marketing/agendaQualityV2/shadow/liveShadowRunner").LiveShadowRunnerDeps
    | undefined;
  if (isAgendaQualityV2ShadowEnabled(process.env) && useRuntime && runtimeExecutor) {
    const { createMarketingAgendaTransformerInvoke } = await import(
      "../src/lib/marketing/agendaQualityV2/transformer/createInvoke"
    );
    const runIdPrefix = v2ShadowRunType === "MANUAL_RERUN" ? "manual" : "scheduled";
    agendaQualityV2Shadow = {
      invoke: createMarketingAgendaTransformerInvoke({
        executor: runtimeExecutor,
        correlationId,
        completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
      }),
      writeArtifacts: true,
      runType: v2ShadowRunType,
      runId: `${runIdPrefix}:${correlationId}`,
    };
  }

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
      ...(agendaQualityV2Shadow ? { agendaQualityV2Shadow } : {}),
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
  const v2Shadow = run.metadata?.agendaQualityV2Shadow as
    | {
        attempted?: boolean;
        status?: string;
        slateCount?: number;
        llmCallCount?: number;
        blockerReason?: string | null;
        artifactJson?: string | null;
        productionLiveShadowReady?: boolean;
      }
    | undefined;
  if (v2Shadow) {
    console.log(`- agendaQualityV2Shadow: ${v2Shadow.status ?? "unknown"}`);
    console.log(`- agendaQualityV2SlateCount: ${v2Shadow.slateCount ?? 0}`);
    console.log(`- agendaQualityV2LlmCalls: ${v2Shadow.llmCallCount ?? 0}`);
    console.log(
      `- agendaQualityV2LiveReady: ${v2Shadow.productionLiveShadowReady ? "yes" : "no"}`,
    );
    if (v2Shadow.blockerReason) {
      console.log(`- agendaQualityV2Blocker: ${v2Shadow.blockerReason}`);
    }
    if (v2Shadow.artifactJson) {
      console.log(`- agendaQualityV2Artifact: ${v2Shadow.artifactJson}`);
    }
  }
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
