#!/usr/bin/env node
import { createRequire } from "node:module";
import { isAbsolute } from "node:path";
const require = createRequire(import.meta.url);
const Module = require("module") as { _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string };
const originalResolve = Module._resolveFilename.bind(Module);
const stub = require.resolve("./shims/server-only.js");
Module._resolveFilename = (request, parent, isMain, options) => request === "server-only" ? stub : originalResolve(request, parent, isMain, options);
import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== "--package-root" || args[2] !== "--job-id" || args[4] !== "--run" || !isAbsolute(args[1]!)) throw new Error("Usage: --package-root <absolute candidate package path> --job-id <UUID> --run. This explicitly runs FFmpeg.");
  const { runShortformJob } = await import("@/lib/marketing/publishable/narrationShortform/service");
  const result = await runShortformJob(args[1]!, args[3]!);
  console.log(JSON.stringify({ jobId: result.jobId, status: result.status, errorCode: result.errorCode,
    sceneCount: result.plan.scenes.length, totalDurationMs: result.timeline.totalDurationMs, output: result.output }));
  if (result.status !== "completed") process.exitCode = 1;
}
main().catch(() => { console.error("Narration shortform worker failed. Check job state, input freshness, FFmpeg and ffprobe."); process.exitCode = 1; });
