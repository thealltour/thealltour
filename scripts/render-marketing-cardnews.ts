#!/usr/bin/env node
/**
 * Render CardNews PNGs into an existing or new Marketing Asset package.
 *
 *   npx tsx scripts/render-marketing-cardnews.ts --candidateId <id>
 *   npx tsx scripts/render-marketing-cardnews.ts --candidateId <id> --root /mnt/HDD2TB/marketing-assets
 *   npx tsx scripts/render-marketing-cardnews.ts --candidateId <id> --dry-run
 *   npx tsx scripts/render-marketing-cardnews.ts --fixture --output-mode graphic-only --root /mnt/HDD2TB/marketing-assets
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
  const { parseRenderMarketingCardNewsArgs, runRenderMarketingCardNewsCommand } = await import(
    "@/lib/marketing/assets"
  );

  const options = parseRenderMarketingCardNewsArgs(process.argv.slice(2));
  const result = await runRenderMarketingCardNewsCommand({ options });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        reason: result.reason ?? null,
        dryRun: result.dryRun,
        wrote: result.wrote,
        reused: result.reused,
        candidateId: result.candidateId,
        packageId: result.packageId,
        packageRoot: result.packageRoot,
        relativePackagePath: result.relativePackagePath,
        plannedRelativePaths: result.plannedRelativePaths,
        cardCount: result.render?.cards.length ?? 0,
        cards: result.render?.cards.map((card) => ({
          cardIndex: card.cardIndex,
          cardRole: card.cardRole,
          relativePath: card.relativePath,
          sha256: card.sha256,
        })),
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
