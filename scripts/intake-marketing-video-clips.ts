#!/usr/bin/env node
/**
 * Manual A-9 incoming clip intake (gated).
 * Reads reel/shot-list.json and reel/incoming/. Does not generate, trim, or transcode.
 *
 *   npx tsx scripts/intake-marketing-video-clips.ts --package-root /abs/pkg --dry-run
 *   npx tsx scripts/intake-marketing-video-clips.ts --package-root /abs/pkg --confirm-dev
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
  const { parseIntakeMarketingVideoClipsArgs, runIntakeMarketingVideoClipsCommand } = await import(
    "@/lib/marketing/assets"
  );
  const options = parseIntakeMarketingVideoClipsArgs(process.argv.slice(2));
  const result = await runIntakeMarketingVideoClipsCommand({ options });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
