#!/usr/bin/env node
/**
 * Manual A-10 preview composer (gated).
 * Reads validated timeline/shot-list/clip-intake/SRT. Does not generate AI media or publish.
 *
 *   npx tsx scripts/compose-marketing-video-preview.ts --package-root /abs/pkg --dry-run
 *   npx tsx scripts/compose-marketing-video-preview.ts --package-root /abs/pkg --confirm-dev
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

async function main() {
  const { parseComposeMarketingVideoPreviewArgs, runComposeMarketingVideoPreviewCommand } = await import(
    "@/lib/marketing/assets"
  );
  const options = parseComposeMarketingVideoPreviewArgs(process.argv.slice(2));
  const result = await runComposeMarketingVideoPreviewCommand({ options });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
