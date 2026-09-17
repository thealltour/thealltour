/**
 * Phase 5 editorial-reframe smoke — V2-only MANUAL_RERUN on persisted 2026-09-17 V1 slate.
 * Does NOT rerun authoritative V1 Daily Plan. Does NOT write V1 slate.
 *
 *   npx tsx scripts/smoke-agenda-quality-v2-phase5-editorial.ts
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
const BUSINESS_DATE = "2026-09-17";

async function main() {
  process.chdir(ROOT);
  const { loadLocalEnv } = await import("./loadLocalEnv");
  loadLocalEnv();

  const {
    isAgendaQualityV2ShadowEnabled,
    resolveAgendaQualityV2MaxTransforms,
    AGENDA_QUALITY_V2_PROMPT_VERSION,
  } = await import("../src/lib/marketing/agendaQualityV2/shadow/config");
  const { isAiRuntimeMarketingCronEnabled, createMarketingCronCorrelationId } = await import(
    "../src/lib/marketing/cron/marketingCronRuntime"
  );
  const { createDailyAgendaSlateRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository"
  );
  const { createRuntimeExecutorStack } = await import(
    "../src/ai-runtime/integration/runtime-stack"
  );
  const { ensureSharedObservabilityRecorder } = await import(
    "../src/ai-runtime/observability/persistence"
  );
  const { createMarketingAgendaTransformerInvoke, getMarketingAgendaTransformerRouteMeta } =
    await import("../src/lib/marketing/agendaQualityV2/transformer/createInvoke");
  const { runAgendaQualityV2LiveShadowSafe } = await import(
    "../src/lib/marketing/agendaQualityV2/shadow/liveShadowRunner"
  );
  const { MARKETING_CRON_HERMES_TIMEOUT_MS } = await import(
    "../src/lib/marketing/cron/marketingPlanSpecialists"
  );
  const {
    writeValidationManifestIfAbsent,
    markPriorValidationManifestSuperseded,
    fingerprintAgendaQualityV2ValidationConfig,
    snapshotAgendaQualityV2ValidationSensitiveConfig,
    AGENDA_QUALITY_V2_VALIDATION_ID,
  } = await import("../src/lib/marketing/agendaQualityV2/shadow/validationManifest");

  const shadowOn = isAgendaQualityV2ShadowEnabled(process.env);
  const runtimeOn = isAiRuntimeMarketingCronEnabled({
    ...process.env,
    AI_RUNTIME_MARKETING_CRON_ENABLED:
      process.env.AI_RUNTIME_MARKETING_CRON_ENABLED?.trim() || "true",
  });
  const maxTransforms = resolveAgendaQualityV2MaxTransforms(process.env);
  const routeMeta = getMarketingAgendaTransformerRouteMeta();

  console.log(
    JSON.stringify(
      {
        phase: "5A_PROMOTIONAL_GUARD_SMOKE",
        businessDateKst: BUSINESS_DATE,
        shadowOn,
        runtimeOn,
        maxTransforms,
        promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
        role: routeMeta.roleKey,
        validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
        cwd: process.cwd(),
      },
      null,
      2,
    ),
  );

  if (!shadowOn) {
    console.error("BLOCKED: AGENDA_QUALITY_V2_SHADOW_ENABLED is not ON");
    process.exit(2);
  }
  if (!runtimeOn) {
    console.error("BLOCKED: AI Runtime marketing cron path unavailable");
    process.exit(2);
  }
  if (AGENDA_QUALITY_V2_PROMPT_VERSION !== "agenda-transform-prompt-v2.1") {
    console.error("BLOCKED: prompt version is not v2.1");
    process.exit(2);
  }

  const superseded = await markPriorValidationManifestSuperseded({ cwd: ROOT });
  const manifestWrite = await writeValidationManifestIfAbsent({
    cwd: ROOT,
    gitHead: null,
    workingTreeDirty: true,
    env: process.env,
  });
  const fp = fingerprintAgendaQualityV2ValidationConfig(
    snapshotAgendaQualityV2ValidationSensitiveConfig(process.env),
  );

  const slateRepo = await createDailyAgendaSlateRepository();
  const v1Slate = await slateRepo.findByBusinessDate(BUSINESS_DATE);
  if (!v1Slate) {
    console.error(`BLOCKED: no persisted V1 slate for ${BUSINESS_DATE}`);
    process.exit(2);
  }
  const slateIdBefore = v1Slate.slateId;
  const slateCountBefore = v1Slate.candidates.length;

  const agendaCandidates = v1Slate.candidates.map((c, idx) => ({
    agendaCandidateId: c.agendaCandidateId ?? c.slateItemId,
    researchBriefId: c.researchBriefId ?? `shadow_smoke_brief_${idx}`,
    title: c.title,
    summary: c.summary ?? c.evidenceSummary ?? c.title,
    destinations: c.destinations ?? [],
    topics: c.topics ?? [],
    entities: c.entities ?? [],
    signalTypes: ["agenda_candidate"],
    publishedAt: null,
    observedAt: v1Slate.createdAt,
    freshnessScore: 0.7,
    credibilityScore: 0.7,
    travelRelevanceScore: 0.7,
    publicInterestScore: 0.6,
    commercialRelevanceScore: 0.6,
    seasonalityScore: 0.5,
    corroborationScore: 0.5,
    noveltyScore: 0.5,
    koreanOutboundRelevanceScore: 0.7,
    totalResearchScore: typeof c.score === "number" ? c.score : 0.6,
    researchScoreComponents: null,
    scoreReasons: c.scoreReasons ?? [],
    riskFlags: c.riskFlags ?? [],
    matchedProductIds: c.matchedProductIds ?? [],
    evidence: [],
    candidateStatus: "ready",
  }));

  await ensureSharedObservabilityRecorder();
  const executor = createRuntimeExecutorStack();
  const correlationId = createMarketingCronCorrelationId();
  const invoke = createMarketingAgendaTransformerInvoke({
    executor,
    correlationId,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });

  const result = await runAgendaQualityV2LiveShadowSafe({
    businessDateKst: BUSINESS_DATE,
    v1Slate,
    agendaCandidates,
    deps: {
      invoke,
      writeArtifacts: true,
      cwd: ROOT,
      env: process.env,
      forceMemory: false,
      runType: "MANUAL_RERUN",
      runId: `phase5a-promo-guard:${correlationId}`,
    },
  });

  const slateAfter = await slateRepo.findByBusinessDate(BUSINESS_DATE);
  const slateUnchanged =
    slateAfter?.slateId === slateIdBefore &&
    (slateAfter?.candidates.length ?? -1) === slateCountBefore;

  const out = {
    status: result.snapshot.status,
    attempted: result.attempted,
    v1Unaffected: result.v1Unaffected,
    slateUnchanged,
    slateId: slateIdBefore,
    promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
    validation: {
      superseded,
      manifestWrite: manifestWrite.status,
      validationId: result.snapshot.validation.validationId,
      fingerprint: result.snapshot.validation.validationConfigFingerprint,
      configStatus: result.snapshot.validation.validationConfigStatus,
      expectedFingerprint: fp,
    },
    artifactJson: result.artifactPaths?.jsonPath ?? null,
    artifactMd: result.artifactPaths?.mdPath ?? null,
    source: result.snapshot.source,
    v2: result.snapshot.v2,
    observability: result.snapshot.observability,
    slate: result.snapshot.slate.map((s) => ({
      rank: s.selection.finalRank,
      source: s.source.sourceTitle,
      archetype: s.transform?.editorialArchetype,
      story_seed: s.transform?.marketingStorySeedKo,
      hidden_detail: s.transform?.hiddenDetailKo,
      promotional_source: s.promotional?.promotionalSource ?? null,
      promotional_specificity_pass: s.promotional?.promotionalSpecificityPass ?? null,
      promotional_generic_risk: s.promotional?.promotionalGenericRisk ?? null,
      quality_tier: s.scoring?.qualityTier,
      total_score: s.scoring?.totalScore,
      origin: s.reservoir?.origin,
    })),
    excludedFocus: result.snapshot.rejectedOrExcluded
      .filter((r) => {
        const t = (r.source.sourceTitle ?? "").toLowerCase();
        return (
          t.includes("best tourism") ||
          t.includes("lang") ||
          t.includes("heritage") ||
          t.includes("ho chi minh") ||
          t.includes("metropolis") ||
          t.includes("bangladesh")
        );
      })
      .map((r) => ({
        source: r.source.sourceTitle,
        seed: r.transform?.marketingStorySeedKo?.slice(0, 100),
        tier: r.scoring?.qualityTier,
        reason: r.selection.exclusionReason ?? r.provenance.transformFailureReason,
        promotional: r.promotional,
        promptVersion: r.provenance.promptVersion,
      })),
  };
  console.log(JSON.stringify(out, null, 2));

  if (result.snapshot.status !== "ok" || !slateUnchanged) {
    process.exitCode = 2;
    console.error("PHASE5A_PROMOTIONAL_GUARD_SMOKE_FAILED");
    return;
  }
  console.log("PHASE5A_PROMOTIONAL_GUARD_SMOKE_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
