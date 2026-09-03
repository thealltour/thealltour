#!/usr/bin/env node
/**
 * Export a CompletedMarketingCandidate into a local Marketing Asset Package.
 *
 * Read-only against the marketing database. Writes files under MARKETING_ASSET_ROOT only.
 * Does not mutate Human Review, publication, SNS, or Telegram.
 *
 *   npx tsx scripts/export-marketing-candidate-assets.ts --candidateId <id>
 *   npx tsx scripts/export-marketing-candidate-assets.ts --candidateId <id> --root /mnt/HDD2TB/marketing-assets
 *   npx tsx scripts/export-marketing-candidate-assets.ts --candidateId <id> --dry-run
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

async function main() {
  const { parseExportMarketingCandidateAssetsArgs, runExportMarketingCandidateAssetsCommand } = await import(
    "@/lib/marketing/assets"
  );

  const options = parseExportMarketingCandidateAssetsArgs(process.argv.slice(2));
  const result = await runExportMarketingCandidateAssetsCommand({ options });

  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        wrote: result.wrote,
        reused: result.reused,
        candidateId: result.candidateId,
        packageId: result.packageId,
        businessDateKst: result.businessDateKst,
        packageRoot: result.packageRoot,
        relativePackagePath: result.relativePackagePath,
        plannedRelativePaths: result.plannedRelativePaths,
        artifactCount: result.artifacts.length,
        integrity: result.manifest.integrity,
        stage: result.manifest.stage,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
