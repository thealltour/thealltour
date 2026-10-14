#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
const require = createRequire(import.meta.url);
const Module = require("module") as { _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string };
const original = Module._resolveFilename.bind(Module); const stub = require.resolve("./shims/server-only.js");
Module._resolveFilename = (request, parent, isMain, options) => request === "server-only" ? stub : original(request, parent, isMain, options);
import { loadLocalEnv } from "./loadLocalEnv";
import { atomicWriteFile } from "../src/lib/marketing/assets/atomicWrite";
loadLocalEnv();
let stopping = false; process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
async function main() {
  const { motionQueueDirectory } = await import("@/lib/marketing/publishable/narrationMotion/service");
  const { runMotionJob } = await import("@/lib/marketing/publishable/narrationMotion/worker");
  const { loadSceneApiContext } = await import("@/lib/marketing/publishable/narrationScenes/apiContext");
  const { readMotionJob } = await import("@/lib/marketing/publishable/narrationMotion/service");
  const { readMotionShortformJob, runMotionShortform, readCaptionShortformJob, runCaptionShortform } = await import("@/lib/marketing/publishable/narrationShortform/motionService");
  const { readAlignmentJob, runCaptionAlignment } = await import("@/lib/marketing/publishable/narrationShortform/captionAlignment");
  const { readStockClipJob } = await import("@/lib/marketing/publishable/narrationVisualSources/clips");
  const { runStockClipJob } = await import("@/lib/marketing/publishable/narrationVisualSources/clipWorker");
  const queue = motionQueueDirectory(); mkdirSync(queue, { recursive: true });
  const health = () => atomicWriteFile(join(queue, "health.json"), JSON.stringify({ heartbeatAt: new Date().toISOString(), pid: process.pid }));
  health(); const heartbeat = setInterval(health, 10_000);
  try {
  while (!stopping) {
    const filenames = readdirSync(queue).filter(n => /^[a-f0-9-]{36}\.json$/.test(n));
    const priority = (filename: string) => {
      try { const entry = JSON.parse(readFileSync(join(queue, filename), "utf8")) as { createdAt?: string; order?: number }; return { createdAt: entry.createdAt ?? "", order: entry.order ?? 0 }; }
      catch { return { createdAt: "", order: 0 }; }
    };
    filenames.sort((a, b) => { const left = priority(a); const right = priority(b); return left.createdAt.localeCompare(right.createdAt) || left.order - right.order || a.localeCompare(b); });
    for (const filename of filenames) {
      if (stopping) break;
      const path = join(queue, filename);
      try {
        const entry = JSON.parse(readFileSync(path, "utf8")) as { root: string; jobId: string; kind?: string };
        if (filename !== `${entry.jobId}.json`) throw new Error("queue_identity_mismatch");
        if (entry.kind !== undefined && entry.kind !== "shortform-v2" && entry.kind !== "shortform-v3" && entry.kind !== "caption-align-v1" && entry.kind !== "stock-clip-v1") throw new Error("queue_kind_invalid");
        const job = entry.kind === "caption-align-v1" ? readAlignmentJob(entry.root, entry.jobId) : entry.kind === "shortform-v3" ? readCaptionShortformJob(entry.root, entry.jobId)
          : entry.kind === "shortform-v2" ? readMotionShortformJob(entry.root, entry.jobId) : entry.kind === "stock-clip-v1" ? readStockClipJob(entry.root, entry.jobId) : readMotionJob(entry.root, entry.jobId);
        const candidateId = "candidateId" in job ? job.candidateId : job.source.candidateId;
        const current = await loadSceneApiContext(candidateId, true);
        if (resolve(current.root) !== resolve(entry.root)) throw new Error("queue_root_mismatch");
        const result = entry.kind === "caption-align-v1" ? await runCaptionAlignment(entry.root, entry.jobId) : entry.kind === "shortform-v3" ? await runCaptionShortform(entry.root, entry.jobId)
          : entry.kind === "shortform-v2" ? await runMotionShortform(entry.root, entry.jobId) : entry.kind === "stock-clip-v1" ? await runStockClipJob(entry.root, entry.jobId) : await runMotionJob(entry.root, entry.jobId);
        console.log(JSON.stringify({ jobId: result.jobId, status: result.status }));
        rmSync(path, { force: true });
      } catch {
        // Keep entries for temporary DB/auth/context outages; no external dispatch before validation.
        console.error(`motion_queue_entry_unavailable:${filename}`);
      }
    }
    if (!stopping) await pause(3000);
  }
  } finally { clearInterval(heartbeat); rmSync(join(queue, "health.json"), { force: true }); }
}
main().catch(() => { console.error("motion_worker_failed"); process.exitCode = 1; });
