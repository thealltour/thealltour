import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import { createFfprobePreviewOutputProbe, assertPreviewOutputMetadata } from "@/lib/marketing/assets/video/preview/outputProbe";
import { renderSrtFromTimeline } from "@/lib/marketing/tts/subtitles/render";
import { NarrationError } from "../narration/persistence";
import { loadSceneSource, requireFreshScenePlan, sceneHash, scenePlanFingerprint } from "../narrationScenes/service";
import { verifySceneAsset } from "../narrationScenes/assets";
import { shortformJobSchema, SHORTFORM_RENDER_CONFIG, type NarrationShortformJob } from "./contracts";
import { buildNarrationShortformArgs } from "./graph";

export const shortformRendererFingerprint = () => sceneHash(SHORTFORM_RENDER_CONFIG);
export function shortformInputFingerprint(job: Pick<NarrationShortformJob, "candidateId" | "plan" | "timeline" | "images" | "rendererFingerprint">) {
  return sceneHash({ candidateId: job.candidateId, planFingerprint: job.plan.fingerprint, timeline: job.timeline,
    images: job.images.map(({ sentenceId, sceneId, visualId, relativePath, sha256, planFingerprint, handoffFingerprint }) => ({ sentenceId, sceneId, visualId, relativePath, sha256, planFingerprint, handoffFingerprint })),
    rendererFingerprint: job.rendererFingerprint });
}
function jobPath(root: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("렌더 작업 ID를 확인해주세요.", 400);
  return join(root, "context/narration/shortform-jobs", `${jobId}.json`);
}
export function readShortformJob(root: string, jobId: string) {
  const path = jobPath(root, jobId); if (!existsSync(path)) throw new NarrationError("렌더 작업을 찾을 수 없습니다.", 404);
  const job = shortformJobSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (job.jobId !== jobId || job.inputFingerprint !== shortformInputFingerprint(job) || job.candidateId !== job.plan.source.candidateId || job.plan.fingerprint !== scenePlanFingerprint(job.plan) ||
      !job.plan.approval || job.plan.approval.revision !== job.plan.revision || job.plan.approval.fingerprint !== job.plan.fingerprint ||
      (job.status === "completed" && !job.output) || (job.status !== "completed" && job.output)) throw new NarrationError("렌더 작업 연결 정보가 다릅니다.", 409);
  return job;
}
export function shortformJobFresh(root: string, job: NarrationShortformJob) {
  try {
    if (job.rendererFingerprint !== shortformRendererFingerprint()) return false;
    const plan = requireFreshScenePlan(root, job.candidateId, job.plan.fingerprint);
    const source = loadSceneSource(root, job.candidateId, plan.source.audioJobId);
    if (sceneHash(source.timeline) !== sceneHash(job.timeline) || job.images.length !== plan.scenes.length ||
        job.plan.scenes.length !== plan.scenes.length || sceneHash(job.plan.source) !== sceneHash(plan.source)) return false;
    return plan.scenes.every((scene, i) => {
      const image = job.images[i]; const originalScene = job.plan.scenes[i];
      if (!image || !originalScene || sceneHash(originalScene) !== sceneHash(scene) || image.visualId !== scene.visualId || image.sceneId !== scene.sceneId || image.sentenceId !== scene.sentenceId) return false;
      const { asset } = verifySceneAsset(root, plan, scene.visualId);
      return image.planFingerprint === plan.fingerprint && asset.sha256 === image.sha256 && asset.relativePath === image.relativePath && asset.handoffFingerprint === image.handoffFingerprint;
    });
  } catch { return false; }
}
export function queueShortformJob(root: string, candidateId: string, planFingerprint: string) {
  const plan = requireFreshScenePlan(root, candidateId, planFingerprint);
  const source = loadSceneSource(root, candidateId, plan.source.audioJobId);
  const images = plan.scenes.map(scene => verifySceneAsset(root, plan, scene.visualId).asset);
  const stable = { candidateId, plan, timeline: source.timeline, images, rendererFingerprint: shortformRendererFingerprint() };
  const job: NarrationShortformJob = { contract: "narration-shortform-render-job-v1", jobId: randomUUID(), ...stable,
    inputFingerprint: shortformInputFingerprint(stable), createdAt: new Date().toISOString(), status: "queued", errorCode: null, output: null };
  if (!shortformJobFresh(root, job)) throw new NarrationError("렌더 요청 중 원문·음성·이미지가 변경되었습니다.");
  atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(job, null, 2)); return job;
}
export async function runShortformJob(root: string, jobId: string) {
  const path = jobPath(root, jobId); const lock = `${path}.lock`;
  mkdirSync(join(root, "context/narration/shortform-jobs"), { recursive: true });
  try { mkdirSync(lock); } catch { throw new NarrationError("렌더 작업이 이미 실행 중입니다."); }
  const candidateLock = join(root, "context/narration/shortform-jobs/.worker-lock");
  let candidateLockHeld = false;
  let job: NarrationShortformJob | null = null;
  const save = () => { if (job) atomicWriteFile(path, JSON.stringify(job, null, 2)); };
  try {
    try { mkdirSync(candidateLock); candidateLockHeld = true; }
    catch { throw new NarrationError("이 후보의 다른 영상 작업이 실행 중입니다. 완료 후 다시 실행해주세요."); }
    job = readShortformJob(root, jobId);
    if (job.status !== "queued") throw new NarrationError("대기 중인 렌더 작업만 실행할 수 있습니다.");
    if (!shortformJobFresh(root, job)) { job.status = "stale"; save(); return job; }
    job.status = "running"; save();
    const runPrefix = `reel/narration-render/${job.inputFingerprint}/${job.jobId}`;
    const absolute = (name: string) => resolvePackageArtifactPath({ packageRoot: root, relativePath: `${runPrefix}/${name}` });
    const images: string[] = []; const audio: string[] = [];
    for (const [i, scene] of job.plan.scenes.entries()) {
      const { bytes } = verifySceneAsset(root, job.plan, scene.visualId);
      if (sha256Buffer(bytes) !== job.images[i]!.sha256) throw new NarrationError("렌더 이미지가 변경되었습니다.");
      const imagePath = absolute(`inputs/${scene.sceneId}.png`); atomicWriteFile(imagePath, bytes); images.push(imagePath);
      const timing = job.timeline.segments[i]!;
      const sourceAudio = resolvePackageArtifactPath({ packageRoot: root, relativePath: timing.relativeAudioPath });
      const wav = readFileSync(sourceAudio);
      if (sha256Buffer(wav) !== timing.audioSha256) throw new NarrationError("렌더 음성이 변경되었습니다.");
      const audioPath = absolute(`inputs/${scene.sentenceId}.wav`); atomicWriteFile(audioPath, wav); audio.push(audioPath);
    }
    const subtitles = renderSrtFromTimeline(job.timeline);
    const subtitlesPath = absolute("subtitles.srt"); atomicWriteFile(subtitlesPath, subtitles);
    if (!shortformJobFresh(root, job)) { job.status = "stale"; save(); return job; }
    const outputPath = absolute("shortform.mp4");
    const args = buildNarrationShortformArgs({ job, images, audio, subtitlesPath, outputPath });
    atomicWriteFile(absolute("render-input.json"), JSON.stringify({ contract: "narration-shortform-render-input-v1", jobId: job.jobId,
      inputFingerprint: job.inputFingerprint, config: SHORTFORM_RENDER_CONFIG, scenes: job.plan.scenes, timeline: job.timeline }, null, 2));
    await runFfmpeg({ args, timeoutMs: 30 * 60 * 1000 });
    const metadata = await createFfprobePreviewOutputProbe().probePreview(outputPath);
    assertPreviewOutputMetadata({ metadata, totalDurationMs: job.timeline.totalDurationMs });
    if (!shortformJobFresh(root, job)) { job.status = "stale"; save(); return job; }
    job.output = { relativePath: `${runPrefix}/shortform.mp4`, sha256: sha256FileSync(outputPath), byteSize: statSync(outputPath).size,
      subtitlesRelativePath: `${runPrefix}/subtitles.srt`, subtitlesSha256: sha256Buffer(subtitles),
      measuredDurationMs: metadata.durationMs, width: 720, height: 1280, fps: 30 };
    job.status = "completed"; save(); return job;
  } catch (error) {
    if (job?.status === "running") { job.status = shortformJobFresh(root, job) ? "failed" : "stale"; job.errorCode = "render_failed"; save(); }
    throw error;
  } finally {
    if (candidateLockHeld) rmSync(candidateLock, { recursive: true });
    rmSync(lock, { recursive: true });
  }
}
export function requireFreshShortformOutput(root: string, candidateId: string, jobId: string) {
  const job = readShortformJob(root, jobId);
  if (job.candidateId !== candidateId || job.status !== "completed" || !job.output || !shortformJobFresh(root, job)) throw new NarrationError("최신 완료 렌더 결과가 필요합니다.");
  const prefix = `reel/narration-render/${job.inputFingerprint}/${job.jobId}`;
  if (job.output.relativePath !== `${prefix}/shortform.mp4` || job.output.subtitlesRelativePath !== `${prefix}/subtitles.srt`) throw new NarrationError("렌더 결과 경로가 다릅니다.");
  const videoPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.relativePath });
  const subtitlesPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.subtitlesRelativePath });
  if (!existsSync(videoPath) || statSync(videoPath).size !== job.output.byteSize || sha256FileSync(videoPath) !== job.output.sha256 ||
      !existsSync(subtitlesPath) || sha256FileSync(subtitlesPath) !== job.output.subtitlesSha256) throw new NarrationError("렌더 결과 파일이 없거나 변경되었습니다.");
  if (!shortformJobFresh(root, job)) throw new NarrationError("결과 확인 중 원문·음성·이미지가 변경되었습니다.");
  return { job, output: job.output, videoPath, subtitlesPath };
}
