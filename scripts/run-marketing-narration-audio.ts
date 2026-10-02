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
  if (args.length !== 5 || args[0] !== "--package-root" || args[2] !== "--job-id" || args[4] !== "--run" || !isAbsolute(args[1]!)) {
    throw new Error("Usage: --package-root <absolute candidate package path> --job-id <UUID> --run. This explicitly executes a queued TTS job.");
  }
  const root = args[1]!;
  const { readNarrationAudioJob, runNarrationAudioJob, resolveNarrationAudioProfile } = await import("@/lib/marketing/publishable/narration/audio");
  const { narrationLineage } = await import("@/lib/marketing/publishable/narration/persistence");
  const { readCanonicalAssetFromPackage } = await import("@/lib/marketing/canonicalAsset/persistence");
  const { parseVoiceStudioConfig } = await import("@/lib/marketing/tts/voiceStudio/config");
  const { VoiceStudioTtsProvider } = await import("@/lib/marketing/tts/voiceStudio/adapter");
  const { createFfprobeDurationProbe } = await import("@/lib/marketing/tts/duration/ffprobe");
  const job = readNarrationAudioJob(root, args[3]!);
  const config = parseVoiceStudioConfig();
  const result = await runNarrationAudioJob({ root, jobId: job.jobId, profile: resolveNarrationAudioProfile(job.profile.profileId),
    endpointIdentity: config.baseUrl, provider: new VoiceStudioTtsProvider(config), durationProbe: createFfprobeDurationProbe(),
    getLineage: () => { const asset = readCanonicalAssetFromPackage(root); if (!asset) throw new Error("Saved Canonical is missing or invalid"); return narrationLineage(asset); } });
  console.log(JSON.stringify({ jobId: result.jobId, status: result.status, errorCode: result.errorCode, totalDurationMs: result.timeline?.totalDurationMs ?? null }));
  if (result.status !== "completed") process.exitCode = 1;
}
main().catch(() => { console.error("Narration audio worker failed. Check job state, approved Canonical and VoiceStudio configuration."); process.exitCode = 1; });
