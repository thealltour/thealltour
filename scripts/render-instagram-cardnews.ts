#!/usr/bin/env node
/**
 * Instagram cardnews render step (asset render, no SNS side effects).
 *
 * Runs separately from the production queue so sharp rasterization never delays
 * the copy human review is waiting for. Only packages whose publishable bundle
 * selected Instagram AND produced a publishable caption get rendered.
 *
 *   npx tsx scripts/render-instagram-cardnews.ts --dry-run
 *   npx tsx scripts/render-instagram-cardnews.ts --date 2026-09-14
 *   npx tsx scripts/render-instagram-cardnews.ts --candidate-id cmc_xxx
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

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const { resolveMarketingAssetRoot } = await import("../src/lib/marketing/assets/config");
  const {
    renderInstagramCardnewsForBusinessDate,
    renderInstagramCardnewsForPackage,
  } = await import("../src/lib/marketing/assets/cardnews/instagramCardnews");
  const { resolvePackageDirectory } = await import("../src/lib/marketing/assets/paths");
  const { PUBLICATION_FLOW_INACTIVE } = await import(
    "../src/lib/marketing/social/publication/governanceBoundary"
  );

  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const graphicOnly = argv.includes("--graphic-only");
  const businessDateKst = argValue(argv, "--date") ?? todayKst();
  const candidateId = argValue(argv, "--candidate-id");
  const assetRoot = resolveMarketingAssetRoot({ explicitRoot: argValue(argv, "--root") ?? null });
  const maxPackagesRaw = Number(argValue(argv, "--max-packages") ?? "8");
  const maxPackages = Number.isFinite(maxPackagesRaw) ? Math.trunc(maxPackagesRaw) : 8;

  const results = candidateId
    ? [
        await renderInstagramCardnewsForPackage({
          packageRoot: resolvePackageDirectory({ assetRoot, businessDateKst, candidateId }),
          assetRoot,
          dryRun,
          graphicOnly,
        }),
      ]
    : await renderInstagramCardnewsForBusinessDate({
        assetRoot,
        businessDateKst,
        dryRun,
        graphicOnly,
        maxPackages,
      });

  console.log(
    JSON.stringify(
      {
        step: "instagram-cardnews-render",
        publicationFlowInactive: PUBLICATION_FLOW_INACTIVE,
        businessDateKst,
        assetRoot,
        dryRun,
        rendered: results.filter((item) => item.status === "rendered").length,
        skipped: results.filter((item) => item.status === "skipped").length,
        results: results.map((item) => ({
          candidateId: item.candidateId,
          status: item.status,
          skipReason: item.skipReason ?? null,
          cardCount: item.cardCount,
          aspectRatios: item.aspectRatios,
          wrote: item.renders.some((render) => render.wrote),
          paths: item.renders.flatMap((render) =>
            render.render?.cards.map((card) => card.relativePath) ?? [],
          ),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
