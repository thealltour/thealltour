/**
 * Regenerate Canonical Marketing Asset with current Asset Source Writer prompt.
 *
 * Usage:
 *   npx tsx scripts/regenerate-canonical-asset.ts --candidate cmc_... [--execute]
 *
 * Default is dry-run. Pass --execute to call Asset Source Writer and persist.
 *
 * NOTE: server-only stub must be installed BEFORE app imports.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string;
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

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  loadEnv();
  const candidateId =
    argValue("--candidate") ?? "cmc_daily_marketing_production_2026_09_18_e0";
  const execute = process.argv.includes("--execute");

  const { createDailyMarketingRunRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createMarketingProductionRequestRepository } = await import(
    "../src/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository"
  );
  const { resolveCanonicalAssetDomainContext, canValidateCanonicalAssetAgainstDomain } =
    await import("../src/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext");
  const { resolveStoryEditorialArchetype } = await import(
    "../src/lib/marketing/canonicalAsset/revisions"
  );
  const { resolveMarketingAssetRoot } = await import("../src/lib/marketing/assets/config");
  const { resolvePackageDirectory } = await import("../src/lib/marketing/assets/paths");
  const { PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY } = await import(
    "../src/lib/marketing/editorialDirector/contracts"
  );

  const runRepo = await createDailyMarketingRunRepository({});
  const prodRepo = await createMarketingProductionRequestRepository({});
  const candidate = await runRepo.findCandidateByCandidateId(candidateId);
  if (!candidate) throw new Error(`candidate_not_found:${candidateId}`);

  const productionRequest = candidate.logicalRunKey
    ? await prodRepo.findByLogicalKey(candidate.logicalRunKey)
    : null;
  const meta = (productionRequest?.metadata ?? {}) as Record<string, unknown>;
  const storySet = (meta.storyPointCandidateSetFull ??
    meta.storyPointCandidateSet ??
    null) as import("../src/lib/marketing/storyPoint/contracts").DurableStoryPointCandidateSet | null;

  const assetRoot = resolveMarketingAssetRoot({});
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: candidate.businessDateKst,
    candidateId: candidate.candidateId,
  });

  const ctx = resolveCanonicalAssetDomainContext({
    candidate,
    packageRoot,
    storyPointCandidateSet: storySet,
  });
  if (!canValidateCanonicalAssetAgainstDomain(ctx)) {
    throw new Error("canonical_asset_validation_context_missing");
  }

  let archetype = resolveStoryEditorialArchetype(ctx.storyPoint);
  if (!archetype) {
    const prov = meta[PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY] as
      | Record<string, { editorialArchetype?: string | null }>
      | undefined;
    archetype = prov?.[ctx.storyPoint.pointId]?.editorialArchetype?.trim() || null;
  }

  console.log(
    JSON.stringify(
      {
        candidateId,
        logicalRunKey: candidate.logicalRunKey,
        packageRoot,
        storyPointId: ctx.storyPoint.pointId,
        editorialArchetype: archetype,
        priorTitle: candidate.canonicalMarketingAsset?.titleKo ?? null,
        priorSourceRevision: candidate.canonicalMarketingAsset?.sourceRevision ?? null,
        execute,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log("DRY_RUN — pass --execute to rewrite with current ASW prompt");
    return;
  }

  const {
    createAssetSourceWriterInvoke,
    createMarketingCronCorrelationId,
    createPublishableComposerInvoke,
    isAiRuntimeMarketingCronEnabled,
  } = await import("../src/lib/marketing/cron/marketingCronRuntime");
  const { MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT } = await import(
    "../src/lib/marketing/cron/marketingPlanSpecialists"
  );
  const { resolveMarketingCronHermesTimeoutMs } = await import(
    "../src/lib/marketing/cron/hermesSpawnFailure"
  );
  const { invokeHermesProfileAsync } = await import(
    "../src/lib/marketing/cron/invokeHermesProfileAsync"
  );
  const { createRuntimeExecutorStack } = await import(
    "../src/ai-runtime/integration/runtime-stack"
  );
  const { ensureSharedObservabilityRecorder } = await import(
    "../src/ai-runtime/observability/persistence"
  );
  const { regenerateCanonicalMarketingAsset } = await import(
    "../src/lib/marketing/canonicalAsset/regenerateCanonicalMarketingAsset"
  );

  const useRuntime = isAiRuntimeMarketingCronEnabled();
  if (useRuntime) await ensureSharedObservabilityRecorder();
  const timeoutMs = resolveMarketingCronHermesTimeoutMs(
    process.env,
    MARKETING_CRON_HERMES_TIMEOUT_MS_DEFAULT,
  );
  const invoke =
    createAssetSourceWriterInvoke({
      useRuntime,
      correlationId: createMarketingCronCorrelationId(),
      executor: useRuntime ? createRuntimeExecutorStack() : undefined,
      completionTimeoutMs: timeoutMs,
      invokeHermesProfile: useRuntime
        ? undefined
        : (profile, prompt) => invokeHermesProfileAsync(profile, prompt, timeoutMs),
    }) ??
    createPublishableComposerInvoke({
      useRuntime,
      correlationId: createMarketingCronCorrelationId(),
      executor: useRuntime ? createRuntimeExecutorStack() : undefined,
      completionTimeoutMs: timeoutMs,
      invokeHermesProfile: useRuntime
        ? undefined
        : (profile, prompt) => invokeHermesProfileAsync(profile, prompt, timeoutMs),
    });
  if (!invoke) throw new Error("asw_invoke_unavailable");

  console.log("ASW regenerate starting…", { useRuntime, timeoutMs });
  const result = await regenerateCanonicalMarketingAsset({
    candidate,
    runRepo,
    invoke,
    productionRequest,
    storyPointCandidateSet: storySet,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        outcome: result.ensure.outcome,
        llmCallCount: result.ensure.llmCallCount,
        editorialArchetype: result.ensure.writerInput.editorialArchetype,
        assetId: result.asset.assetId,
        sourceRevision: result.asset.sourceRevision,
        titleKo: result.asset.titleKo,
        decisionGuidanceKo: result.asset.decisionGuidanceKo,
        openingHookKo: result.asset.openingHookKo.slice(0, 180),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
