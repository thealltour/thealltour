import "server-only";
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { failNarrationAudioJob, readNarrationAudioJob } from "./audio";
import { NarrationError } from "./persistence";
import { voiceStudioExecutionLockPath } from "@/lib/marketing/tts/voiceStudio/executionLock";

function dispatchPath(root: string, jobId: string) { return join(root, "context/narration/audio-jobs", `${jobId}.dispatch.json`); }

/** A detached process outlives HTTP requests; flock serializes access to the mini PC. Service restarts may stop its cgroup; status reads reconcile interrupted jobs. */
export async function dispatchNarrationAudio(root: string, jobId: string): Promise<void> {
  const job = readNarrationAudioJob(root, jobId);
  if (job.status !== "queued") return;
  const path = dispatchPath(root, jobId);
  if (existsSync(path)) return;
  const repo = process.cwd();
  if (process.platform !== "linux" || !existsSync(join(repo, "scripts/run-marketing-narration-audio.ts")) || !existsSync("/usr/bin/flock")) {
    failNarrationAudioJob(root, jobId, "worker_unavailable");
    throw new NarrationError("음성 작업 실행기를 사용할 수 없습니다. 서버 설정을 확인해주세요.", 503);
  }
  let reservation: number;
  try { reservation = openSync(path, "wx", 0o600); } catch { return; }
  let log: number | undefined;
  try {
    const lock = voiceStudioExecutionLockPath(job.endpointIdentity);
    log = openSync(join(root, "context/narration/audio-jobs", `${jobId}.log`), "a", 0o600);
    const child = spawn("/usr/bin/flock", ["-w", "1800", "-E", "75", lock, process.execPath,
      "--import", "tsx", "scripts/run-marketing-narration-audio.ts", "--package-root", root, "--job-id", jobId, "--run"],
    { cwd: repo, shell: false, detached: true, stdio: ["ignore", log, log] });
    await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    writeFileSync(reservation, JSON.stringify({ pid: child.pid, dispatchedAt: new Date().toISOString() }));
    child.unref();
  } catch {
    rmSync(path, { force: true });
    failNarrationAudioJob(root, jobId, "worker_start_failed");
    throw new NarrationError("음성 작업을 시작하지 못했습니다. 다시 요청해주세요.", 503);
  } finally { closeSync(reservation); if (log !== undefined) closeSync(log); }
}

/** Recover an interrupted worker on the next status read instead of waiting forever. */
export function reconcileNarrationAudioWorker(root: string, jobId: string) {
  const job = readNarrationAudioJob(root, jobId);
  if (job.status !== "queued" && job.status !== "running") return job;
  const path = dispatchPath(root, jobId);
  if (!existsSync(path)) return job;
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) {
    if (Date.now() - Date.parse(job.createdAt) > 60_000) failNarrationAudioJob(root, jobId, "worker_start_failed");
    return readNarrationAudioJob(root, jobId);
  }
  const dispatch = JSON.parse(raw) as { pid?: number };
  try {
    if (!Number.isSafeInteger(dispatch.pid) || dispatch.pid! < 2) throw new Error("invalid pid");
    process.kill(dispatch.pid!, 0);
    if (!readFileSync(`/proc/${dispatch.pid}/cmdline`, "utf8").includes(jobId)) throw new Error("worker pid was reused");
  } catch { failNarrationAudioJob(root, jobId, "worker_interrupted"); }
  return readNarrationAudioJob(root, jobId);
}
