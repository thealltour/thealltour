/**
 * Day-0 controlled Live Shadow smoke — does NOT run full daily V1 slate job.
 * Loads today's persisted V1 slate + maps slate candidates as transform pool.
 * Uses real marketing_agenda_transformer via AI Runtime.
 *
 *   npx tsx scripts/smoke-agenda-quality-v2-live-shadow-day0.ts
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

async function main() {
  process.chdir(ROOT);
  const { loadLocalEnv } = await import("./loadLocalEnv");
  loadLocalEnv();

  const {
    isAgendaQualityV2ShadowEnabled,
    resolveAgendaQualityV2MaxTransforms,
  } = await import("../src/lib/marketing/agendaQualityV2/shadow/config");
  const { isAiRuntimeMarketingCronEnabled, createMarketingCronCorrelationId } = await import(
    "../src/lib/marketing/cron/marketingCronRuntime"
  );
  const { formatKstBusinessDate } = await import(
    "../src/lib/marketing/cron/daily/kstBusinessDate"
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
  const { createClient } = await import("@supabase/supabase-js");
  const { isReservoirEligibleForFutureSlate } = await import(
    "../src/lib/marketing/agendaQualityV2/reservoir/types"
  );
  const { buildFiveDayLiveShadowRollup } = await import(
    "../src/lib/marketing/agendaQualityV2/shadow/fiveDayReview"
  );
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");

  const businessDateKst = formatKstBusinessDate(new Date());
  const shadowOn = isAgendaQualityV2ShadowEnabled(process.env);
  const runtimeOn = isAiRuntimeMarketingCronEnabled({
    ...process.env,
    // Day-0 smoke forces Runtime path (matches hermes wrapper default true)
    AI_RUNTIME_MARKETING_CRON_ENABLED:
      process.env.AI_RUNTIME_MARKETING_CRON_ENABLED?.trim() || "true",
  });
  const maxTransforms = resolveAgendaQualityV2MaxTransforms(process.env);
  const routeMeta = getMarketingAgendaTransformerRouteMeta();

  console.log(
    JSON.stringify(
      {
        phase: "4B_DAY0_SMOKE",
        businessDateKst,
        shadowOn,
        runtimeOn,
        maxTransforms,
        role: routeMeta.roleKey,
        routeModels: routeMeta.modelIds,
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
  if (maxTransforms > 12) {
    console.error("BLOCKED: max transforms > 12");
    process.exit(2);
  }

  const slateRepo = await createDailyAgendaSlateRepository();
  const v1Slate = await slateRepo.findByBusinessDate(businessDateKst);
  if (!v1Slate) {
    console.error(`BLOCKED: no persisted V1 slate for ${businessDateKst}`);
    process.exit(2);
  }

  // Map persisted V1 slate items → CompactManagerAgendaCandidate (reuse current day context; no V1 rewrite)
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

  const slateCountBefore = v1Slate.candidates.length;
  await ensureSharedObservabilityRecorder();
  const executor = createRuntimeExecutorStack();
  const correlationId = createMarketingCronCorrelationId();
  const invoke = createMarketingAgendaTransformerInvoke({
    executor,
    correlationId,
    completionTimeoutMs: MARKETING_CRON_HERMES_TIMEOUT_MS,
  });

  const result = await runAgendaQualityV2LiveShadowSafe({
    businessDateKst,
    v1Slate,
    agendaCandidates,
    deps: {
      invoke,
      writeArtifacts: true,
      cwd: ROOT,
      env: process.env,
      forceMemory: false,
      runType: "MANUAL_RERUN",
      runId: `manual:${correlationId}`,
    },
  });

  // V1 unchanged check
  const slateAfter = await slateRepo.findByBusinessDate(businessDateKst);
  const slateUnchanged =
    slateAfter?.slateId === v1Slate.slateId &&
    (slateAfter?.candidates.length ?? -1) === slateCountBefore;

  // Reservoir marker validation
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows } = await sb
    .from("marketing_agenda_reservoir_v2")
    .select("agenda_id, lifecycle_status, payload, freshness_class, expires_at")
    .order("updated_at", { ascending: false })
    .limit(40);

  const liveRows = (rows ?? []).filter((r) => {
    const p = r.payload as { qualityVersion?: string; shadow?: boolean };
    return p?.qualityVersion === "v2" && p?.shadow === true;
  });
  const missingMarkers = (rows ?? []).filter((r) => {
    const p = r.payload as { qualityVersion?: string; shadow?: boolean };
    // Only flag rows that look like today's smoke (in snapshot slate/rejected)
    const ids = new Set([
      ...result.snapshot.slate.map((s) => String(s.agendaId)),
      ...result.snapshot.rejected.map((s) => String(s.agendaId ?? "")),
    ]);
    return ids.has(String(r.agenda_id)) && !(p?.qualityVersion === "v2" && p?.shadow === true);
  });

  const deferred = liveRows.filter((r) => r.lifecycle_status === "DEFERRED");
  const selected = liveRows.filter((r) => r.lifecycle_status === "SELECTED");
  const rejected = liveRows.filter((r) => r.lifecycle_status === "REJECTED");
  const expired = liveRows.filter((r) => r.lifecycle_status === "EXPIRED");

  // eligibility spot-check on deferred payloads
  let deferredEligible = true;
  for (const r of deferred.slice(0, 5)) {
    const item = r.payload as Parameters<typeof isReservoirEligibleForFutureSlate>[0];
    if (item && !isReservoirEligibleForFutureSlate(item)) deferredEligible = false;
  }
  let selectedExcluded = true;
  for (const r of selected.slice(0, 3)) {
    const item = r.payload as Parameters<typeof isReservoirEligibleForFutureSlate>[0];
    if (item && isReservoirEligibleForFutureSlate(item)) selectedExcluded = false;
  }
  let rejectedExcluded = true;
  for (const r of rejected.slice(0, 3)) {
    const item = r.payload as Parameters<typeof isReservoirEligibleForFutureSlate>[0];
    if (item && isReservoirEligibleForFutureSlate(item)) rejectedExcluded = false;
  }
  let expiredExcluded = true;
  for (const r of expired.slice(0, 3)) {
    const item = r.payload as Parameters<typeof isReservoirEligibleForFutureSlate>[0];
    if (item && isReservoirEligibleForFutureSlate(item)) expiredExcluded = false;
  }

  // Rollup readiness: load available live-shadow JSON if any
  const liveDir = path.join(ROOT, "artifacts/agenda-quality-v2/live-shadow");
  let rollupReady = false;
  try {
    const files = (await fs.readdir(liveDir)).filter((f) => f.endsWith(".json"));
    const snaps = [];
    for (const f of files.slice(-5)) {
      snaps.push(JSON.parse(await fs.readFile(path.join(liveDir, f), "utf8")));
    }
    if (snaps.length) {
      buildFiveDayLiveShadowRollup(snaps);
      rollupReady = true;
    }
  } catch {
    rollupReady = false;
  }

  const out = {
    status: result.snapshot.status,
    attempted: result.attempted,
    v1Unaffected: result.v1Unaffected,
    slateUnchanged,
    artifactJson: result.artifactPaths?.jsonPath ?? null,
    artifactMd: result.artifactPaths?.mdPath ?? null,
    source: result.snapshot.source,
    v2: result.snapshot.v2,
    observability: result.snapshot.observability,
    humanReviewPreference: result.snapshot.humanReviewPreference,
    reservoir: {
      liveRowsWithMarkers: liveRows.length,
      missingMarkersOnSmokeIds: missingMarkers.length,
      deferredCount: deferred.length,
      deferredEligible,
      selectedExcluded,
      rejectedExcluded,
      expiredExcluded,
    },
    rollupReady,
    slatePreview: result.snapshot.slate.map((s) => ({
      rank: s.rank,
      tier: s.qualityTier,
      origin: s.origin,
      seed: String(s.marketingStorySeedKo).slice(0, 80),
      problem: String(s.travelerProblemKo).slice(0, 80),
      decision: String(s.decisionAtStakeKo).slice(0, 80),
      score: s.totalScore,
    })),
    rejectedPreview: result.snapshot.rejected.slice(0, 8),
  };
  console.log(JSON.stringify(out, null, 2));

  if (result.snapshot.status !== "ok" || !slateUnchanged || missingMarkers.length > 0) {
    process.exitCode = 2;
    console.error("DAY0_SMOKE_FAILED");
    return;
  }
  console.log("DAY0_SMOKE_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
