#!/usr/bin/env node
/**
 * Development TTS profile/provider probe.
 *
 *   npx tsx scripts/test-marketing-tts.ts --profile standard-ko-development --text "다낭 효도여행" --dry-run
 *   npx tsx scripts/test-marketing-tts.ts --profile standard-ko-development --text "다낭 효도여행" --output /tmp/tts-dev
 *
 * Dry-run resolves a profile and prints a bounded request plan. No network, no files.
 * Non-dry-run may call a configured VoiceStudio URL and write development artifacts only.
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
  const { parseTestMarketingTtsArgs, runTestMarketingTtsCommand } = await import("@/lib/marketing/tts");
  const options = parseTestMarketingTtsArgs(process.argv.slice(2));
  const result = await runTestMarketingTtsCommand({ options });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
