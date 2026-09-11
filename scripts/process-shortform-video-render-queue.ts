#!/usr/bin/env node
/**
 * Mini-PC oneshot shortform VideoRenderJob worker (SV-7 runtime + SV-8A production executor wiring).
 *
 * Does NOT install systemd, apply migrations, or run live provider/TTS smoke (SV-8B/C).
 * Production executor isReady() remains fail-closed without ffmpeg/ffprobe/workspace/config.
 *
 *   npm run marketing:shortform-worker
 *   npm run marketing:shortform-worker:health
 *   npx tsx scripts/process-shortform-video-render-queue.ts --health
 *
 * Fail-closed: SHORTFORM_VIDEO_WORKER_ENABLED must be "true" to claim.
 * Without SV-8 production executor, claims never proceed.
 *
 * NOTE: Dynamic imports after server-only stub (same pattern as production queue).
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

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main() {
  const argv = process.argv.slice(2);
  const healthOnly = hasFlag(argv, "--health");
  const dryRun = hasFlag(argv, "--dry-run") || hasFlag(argv, "--inspect");

  const { loadShortformVideoWorkerConfig } = await import(
    "@/lib/marketing/assets/shortform/worker/config"
  );
  const { buildShortformWorkerHealthReport } = await import(
    "@/lib/marketing/assets/shortform/worker/health"
  );
  const { createShortformVideoRenderJobRepository } = await import(
    "@/lib/marketing/assets/shortform/renderJob/createRepository"
  );
  const { processShortformVideoRenderQueue } = await import(
    "@/lib/marketing/assets/shortform/worker/processQueue"
  );

  let config = loadShortformVideoWorkerConfig(process.env);
  if (dryRun) {
    config = { ...config, executionMode: "dry_run" };
  }
  const workerIdOverride = argValue(argv, "--worker-id");
  if (workerIdOverride?.trim()) {
    config = { ...config, workerId: workerIdOverride.trim().slice(0, 80) };
  }
  const maxJobsRaw = Number(argValue(argv, "--max-jobs") ?? config.maxJobsPerRun);
  if (Number.isFinite(maxJobsRaw) && maxJobsRaw >= 1) {
    config = { ...config, maxJobsPerRun: Math.min(Math.trunc(maxJobsRaw), 3) };
  }

  const backend = argValue(argv, "--backend") === "memory" ? "memory" : undefined;

  // Production CLI: wire Production executor (still fail-closed via isReady/ffmpeg).
  // Fake executor is never constructed here.
  let executor;
  if (config.executionMode === "production") {
    const { createMarketingMediaSourceCatalogRepository } = await import(
      "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository"
    );
    const { ProductionShortformVideoRenderExecutor } = await import(
      "@/lib/marketing/assets/shortform/production/productionExecutor"
    );
    const catalog = await createMarketingMediaSourceCatalogRepository(
      backend ? { backend: "memory" } : {},
    );
    executor = new ProductionShortformVideoRenderExecutor({ catalog });
  } else {
    const { createDefaultShortformVideoRenderExecutor } = await import(
      "@/lib/marketing/assets/shortform/worker/executor"
    );
    executor = createDefaultShortformVideoRenderExecutor({
      executionMode: config.executionMode,
    });
  }

  if (healthOnly) {
    const report = await buildShortformWorkerHealthReport({ config, executor });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const abort = new AbortController();
  const onSignal = (signal: string) => {
    console.error(`shortform worker received ${signal}; requesting abort`);
    abort.abort();
  };
  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("SIGINT", () => onSignal("SIGINT"));

  const repository = await createShortformVideoRenderJobRepository(
    backend ? { backend: "memory" } : {},
  );

  console.log(
    [
      "# Shortform Video Render Queue Worker",
      "",
      `- workerId: ${config.workerId}`,
      `- enabled: ${config.enabled}`,
      `- executionMode: ${config.executionMode}`,
      `- executor: ${executor.kind} (${executor.readinessReason()})`,
      `- maxJobsPerRun: ${config.maxJobsPerRun}`,
      `- workspace: ${config.workspaceRoot}`,
      "",
    ].join("\n"),
  );

  const result = await processShortformVideoRenderQueue({
    config,
    repository,
    executor,
    signal: abort.signal,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`shortform video worker failed: ${message}`);
  process.exit(1);
});
