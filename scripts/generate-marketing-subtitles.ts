#!/usr/bin/env node
/**
 * Manual A-7 SRT projection (gated). Reads reel/timeline.json only.
 * Does not call TTS, ffprobe, or the network.
 *
 *   npx tsx scripts/generate-marketing-subtitles.ts --package-root /abs/pkg --dry-run
 *   npx tsx scripts/generate-marketing-subtitles.ts --package-root /abs/pkg --confirm-dev
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
  const { parseGenerateMarketingSubtitlesArgs, runGenerateMarketingSubtitlesCommand } = await import(
    "@/lib/marketing/tts"
  );
  const options = parseGenerateMarketingSubtitlesArgs(process.argv.slice(2));
  const result = runGenerateMarketingSubtitlesCommand({ options });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
