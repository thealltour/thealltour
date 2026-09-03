#!/usr/bin/env node
/**
 * Manual A-6 narration timeline smoke (gated).
 *
 * Dry-run (no network, no files):
 *   npx tsx scripts/generate-marketing-narration-timeline.ts --fixture --dry-run
 *
 * Live development package only — never a production candidate:
 *   VOICESTUDIO_BASE_URL=http://127.0.0.1:13900 \
 *   npx tsx scripts/generate-marketing-narration-timeline.ts \
 *     --fixture --confirm-dev \
 *     --package-root /mnt/HDD2TB/marketing-assets/2026/09/03/dev-tts-a6-verification
 *
 * Authoritative clock is ffprobe on persisted WAVs, not provider duration.
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
  const { parseGenerateNarrationTimelineArgs, runGenerateNarrationTimelineCommand } = await import(
    "@/lib/marketing/tts"
  );
  const options = parseGenerateNarrationTimelineArgs(process.argv.slice(2));
  const result = await runGenerateNarrationTimelineCommand({ options });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
