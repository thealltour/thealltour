import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { NarrationError } from "../narration/persistence";
import { readScenePlan, requireFreshScenePlan, sceneHash, withSceneLock } from "../narrationScenes/service";
import { verifySceneAsset } from "../narrationScenes/assets";
import { motionJobSchema, motionSettingsSchema, type MotionJob, type MotionSettings, type MotionChoice } from "./contracts";
import { resolveMotionConfig } from "./presets";
import { motionFrameLayout } from "./frameLayout";
import { choicesForPlan } from "../narrationVisualSources/store";

export const motionDirectory = (root: string) => join(root, "context/narration/motion");
export const motionQueueDirectory = () => process.env.NARRATION_MOTION_QUEUE_DIR || join(process.cwd(), "data/narration-motion-queue");
export function motionWorkerAvailable() {
  try { const health = JSON.parse(readFileSync(join(motionQueueDirectory(), "health.json"), "utf8")) as { heartbeatAt: string };
    const age = Date.now() - Date.parse(health.heartbeatAt); return Number.isFinite(age) && age >= 0 && age < 90_000;
  } catch { return false; }
}
const indexSchema = z.record(z.string().uuid(), z.string().uuid());
const parseFile = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;
function indexPath(root: string) { return join(motionDirectory(root), "jobs-current.json"); }
function readIndex(root: string) { return existsSync(indexPath(root)) ? indexSchema.parse(parseFile(indexPath(root))) : {}; }
function jobPath(root: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("모션 작업 ID를 확인해주세요.", 400);
  return join(motionDirectory(root), "jobs", `${jobId}.json`);
}
export const motionFingerprint = (job: Pick<MotionJob, "source" | "config">) => sceneHash({ contract: "narration-scene-motion-input-v1", source: job.source, config: job.config });
export function readMotionSettings(root: string): MotionSettings | null {
  const path = join(motionDirectory(root), "settings.json"); if (!existsSync(path)) return null;
  const settings = motionSettingsSchema.parse(parseFile(path));
  const { fingerprint, ...body } = settings;
  if (sceneHash(body) !== fingerprint || new Set(settings.scenes.map(s => s.visualId)).size !== settings.scenes.length) throw new NarrationError("모션 설정 연결 정보가 다릅니다.", 409);
  return settings;
}
export function readMotionJob(root: string, jobId: string) {
  const path = jobPath(root, jobId); if (!existsSync(path)) throw new NarrationError("모션 작업을 찾을 수 없습니다.", 404);
  const job = motionJobSchema.parse(parseFile(path));
  if (job.jobId !== jobId || job.inputFingerprint !== motionFingerprint(job) || job.source.sceneId !== job.source.sentenceId || job.source.visualId !== job.source.sentenceId ||
    job.source.endFrame <= job.source.startFrame || (job.status === "completed") !== !!job.output ||
    (job.approval && (!job.output || job.approval.inputFingerprint !== job.inputFingerprint || job.approval.outputSha256 !== job.output.sha256))) throw new NarrationError("모션 작업 연결 정보가 다릅니다.", 409);
  return job;
}
export function writeMotionJob(root: string, job: MotionJob) { atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(motionJobSchema.parse(job), null, 2), 0o600); }
function buildSource(root: string, candidateId: string, planFingerprint: string, visualId: string) {
  const plan = requireFreshScenePlan(root, candidateId, planFingerprint);
  const i = plan.scenes.findIndex(s => s.visualId === visualId); if (i < 0) throw new NarrationError("현재 계획에 없는 장면입니다.", 400);
  const scene = plan.scenes[i]!; const { asset } = verifySceneAsset(root, plan, visualId);
  return { candidateId, planFingerprint, sentenceId: scene.sentenceId, sceneId: scene.sceneId, visualId,
    imageSha256: asset.sha256, imageRelativePath: asset.relativePath, ...motionFrameLayout(plan)[i]! };
}
export function motionJobFresh(root: string, job: MotionJob) {
  try {
    const settings = readMotionSettings(root);
    const selected = settings?.planFingerprint === job.source.planFingerprint ? settings.scenes.find(s => s.visualId === job.source.visualId) : null;
    if (!selected) return false;
    return motionFingerprint({ source: buildSource(root, job.source.candidateId, job.source.planFingerprint, job.source.visualId), config: resolveMotionConfig(selected.choice) }) === job.inputFingerprint;
  } catch { return false; }
}
export function requireMotionOutput(root: string, candidateId: string, jobId: string, approved = false) {
  const job = readMotionJob(root, jobId);
  if (job.source.candidateId !== candidateId || job.status !== "completed" || !job.output || !motionJobFresh(root, job) || (approved && !job.approval)) throw new NarrationError("최신 완료 모션 결과가 필요합니다.", 409);
  const prefix = `media/narration-motion/${job.inputFingerprint}/${job.jobId}`;
  if (job.output.relativePath !== `${prefix}/scene.mp4` || job.output.manifestRelativePath !== `${prefix}/execution.json` ||
    job.output.frameCount !== job.source.endFrame - job.source.startFrame || Math.abs(job.output.durationMs - job.output.frameCount * 1000 / 30) > 50) throw new NarrationError("모션 출력 연결 정보가 다릅니다.", 409);
  const path = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.relativePath });
  const manifest = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.manifestRelativePath });
  if (!existsSync(path) || !existsSync(manifest) || statSync(path).size !== job.output.byteSize || sha256FileSync(path) !== job.output.sha256 || sha256FileSync(manifest) !== job.output.manifestSha256) throw new NarrationError("모션 결과 파일이 없거나 변경되었습니다.", 409);
  if (!motionJobFresh(root, job)) throw new NarrationError("모션 확인 중 입력이 변경되었습니다.", 409);
  return { job, path };
}
export function saveMotionSettings(root: string, candidateId: string, planFingerprint: string, expected: string | null, scenes: Array<{ visualId: string; choice: MotionChoice }>) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, planFingerprint); const previous = readMotionSettings(root);
    if ((previous?.fingerprint ?? null) !== expected) throw new NarrationError("다른 화면에서 모션 설정이 변경되었습니다. 다시 불러와주세요.", 409);
    if (scenes.length !== plan.scenes.length || scenes.some((s, i) => s.visualId !== plan.scenes[i]!.visualId)) throw new NarrationError("모든 장면의 모션 설정을 순서대로 지정해주세요.", 400);
    const same = previous?.planFingerprint === planFingerprint && sceneHash(previous.scenes) === sceneHash(scenes);
    if (same) return previous!;
    const body = { contract: "narration-scene-motion-settings-v1" as const, revision: (previous?.revision ?? 0) + 1, planFingerprint, scenes };
    const settings = motionSettingsSchema.parse({ ...body, fingerprint: sceneHash(body) });
    // Reverting a choice later must not revive approval for a changed scene.
    const currentJobs = readIndex(root);
    for (const selected of scenes) {
      const oldChoice = previous?.scenes.find(s => s.visualId === selected.visualId)?.choice;
      if (previous?.planFingerprint !== planFingerprint || sceneHash(oldChoice ?? null) !== sceneHash(selected.choice)) {
        const id = currentJobs[selected.visualId];
        if (id) { const oldJob = readMotionJob(root, id); if (oldJob.approval) writeMotionJob(root, { ...oldJob, approval: null }); }
      }
    }
    if (previous) atomicWriteFile(join(motionDirectory(root), "revisions", `${previous.revision}-${previous.fingerprint}.json`), JSON.stringify(previous, null, 2));
    atomicWriteFile(join(motionDirectory(root), "settings.json"), JSON.stringify(settings, null, 2)); return settings;
  });
}
function requireSettings(root: string, planFingerprint: string, expected: string) {
  const settings = readMotionSettings(root);
  if (!settings || settings.fingerprint !== expected || settings.planFingerprint !== planFingerprint) throw new NarrationError("모션 설정을 먼저 저장해주세요.", 409);
  return settings;
}
export function queueMotionJobs(root: string, candidateId: string, planFingerprint: string, expected: string, visualIds: string[]) {
  if (!motionWorkerAvailable()) throw new NarrationError("모션 실행기가 연결되지 않았습니다. 서버 실행 상태를 확인해주세요.", 503);
  return withSceneLock(root, () => {
    const settings = requireSettings(root, planFingerprint, expected); const index = readIndex(root);
    if (new Set(visualIds).size !== visualIds.length) throw new NarrationError("장면이 중복되었습니다.", 400);
    // Validate the whole batch before publishing any request.
    const snapshots = visualIds.map(visualId => {
      const selected = settings.scenes.find(s => s.visualId === visualId); if (!selected) throw new NarrationError("설정이 없는 장면입니다.", 400);
      return { source: buildSource(root, candidateId, planFingerprint, visualId), config: resolveMotionConfig(selected.choice) };
    });
    const jobs = snapshots.map(snapshot => {
      const inputFingerprint = motionFingerprint(snapshot); const oldId = index[snapshot.source.visualId];
      let previous: MotionJob | null = null; if (oldId) { try { previous = readMotionJob(root, oldId); } catch { /* Replace unusable state. */ } }
      if (previous?.inputFingerprint === inputFingerprint && ["queued", "running", "completed"].includes(previous.status) && motionJobFresh(root, previous)) {
        if (previous.status === "completed") { try { requireMotionOutput(root, candidateId, previous.jobId); return previous; } catch { /* Regenerate corrupt/missing output. */ } }
        else {
          if (previous.status === "queued") atomicWriteFile(join(motionQueueDirectory(), `${previous.jobId}.json`), JSON.stringify({ root, jobId: previous.jobId, createdAt: previous.createdAt, order: previous.source.startFrame }), 0o600);
          return previous;
        }
      }
      const job: MotionJob = { contract: "narration-scene-motion-job-v1", jobId: randomUUID(), ...snapshot, inputFingerprint,
        status: "queued", errorCode: null, createdAt: new Date().toISOString(), startedAt: null, heartbeatAt: null, completedAt: null, output: null, approval: null };
      writeMotionJob(root, job); index[job.source.visualId] = job.jobId;
      atomicWriteFile(indexPath(root), JSON.stringify(index));
      atomicWriteFile(join(motionQueueDirectory(), `${job.jobId}.json`), JSON.stringify({ root, jobId: job.jobId, createdAt: job.createdAt, order: job.source.startFrame }), 0o600);
      return job;
    });
    return jobs;
  });
}
export function approveMotionJobs(root: string, candidateId: string, planFingerprint: string, expected: string, selected: Array<{ jobId: string; expectedOutputSha256: string }>) {
  return withSceneLock(root, () => {
    requireSettings(root, planFingerprint, expected);
    const jobs = selected.map(s => {
      const { job } = requireMotionOutput(root, candidateId, s.jobId);
      if (job.source.planFingerprint !== planFingerprint || job.output!.sha256 !== s.expectedOutputSha256) throw new NarrationError("검토한 모션 결과가 변경되었습니다.", 409);
      return job;
    });
    for (const job of jobs) writeMotionJob(root, { ...job, approval: { inputFingerprint: job.inputFingerprint, outputSha256: job.output!.sha256, approvedAt: new Date().toISOString() } });
    return jobs.length;
  });
}
export function motionView(root: string, candidateId: string) {
  const plan = readScenePlan(root); const settings = readMotionSettings(root); const index = readIndex(root);
  let ready = false;
  try { if (plan) { requireFreshScenePlan(root, candidateId, plan.fingerprint); ready = true; } } catch { /* Show stale state without enabling mutation. */ }
  let sources: Record<string, "image_motion" | "stock_video"> = {};
  try { if (plan) sources = Object.fromEntries(choicesForPlan(root, plan).choices.map(c => [c.visualId, c.source])); } catch { /* Unreadable selection: render inputs report it. */ }
  const scenes = plan?.source.candidateId === candidateId ? plan.scenes.map(scene => {
    let imageReady = false; try { if (ready) { verifySceneAsset(root, plan, scene.visualId); imageReady = true; } } catch { /* Upload required. */ }
    let job: MotionJob | null = null;
    try {
      if (index[scene.visualId]) job = readMotionJob(root, index[scene.visualId]!);
      if (job && !motionJobFresh(root, job)) job = { ...job, status: "stale", approval: null, output: null };
      else if (job?.status === "completed") requireMotionOutput(root, candidateId, job.jobId);
    } catch { if (job) job = { ...job, status: "failed", errorCode: "output_invalid", approval: null, output: null }; }
    return { visualId: scene.visualId, text: scene.sentenceText, durationMs: scene.sceneEndMs - scene.startMs, imageReady, source: sources[scene.visualId] ?? "image_motion",
      choice: settings?.planFingerprint === plan.fingerprint ? settings.scenes.find(s => s.visualId === scene.visualId)?.choice ?? { preset: "parallax", strength: "standard" } : { preset: "parallax", strength: "standard" },
      job: job ? { jobId: job.jobId, status: job.status, errorCode: job.errorCode, output: job.output, approved: !!job.approval } : null };
  }) : [];
  return { ready, workerAvailable: motionWorkerAvailable(), settingsSaved: settings?.planFingerprint === plan?.fingerprint,
    planFingerprint: plan?.fingerprint ?? null, settingsFingerprint: settings?.fingerprint ?? null, scenes };
}
