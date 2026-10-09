import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import { createFfprobePreviewOutputProbe, type PreviewOutputMetadata } from "@/lib/marketing/assets/video/preview/outputProbe";
import { isCompatiblePreviewFps, VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS } from "@/lib/marketing/assets/video/preview/profile";
import { renderSrtFromTimeline } from "@/lib/marketing/tts/subtitles/render";
import { NarrationError } from "../narration/persistence";
import { loadSceneSource, requireFreshScenePlan, sceneHash, scenePlanFingerprint, withSceneLock } from "../narrationScenes/service";
import { verifySceneAsset } from "../narrationScenes/assets";
import { motionView, requireMotionOutput, motionQueueDirectory, motionWorkerAvailable } from "../narrationMotion/service";
import { openingHookApproved, openingHookRenderState } from "../narration/openingHook";
import { readNarrationAudioJob } from "../narration/audio";
import { audioReviewPendingMessage, audioReviewState } from "../narration/audioReview";
import { motionShortformJobSchema, motionRenderConfigSchema, captionRenderConfigSchema, captionShortformJobSchema, type MotionShortformJob, type CaptionShortformJob } from "./motionContracts";
import { buildMotionShortformArgs } from "./motionGraph";
import { renderMotionAss, renderCaptionAss, renderCaptionSrt } from "./motionSubtitles";
import { captionApproved, captionFontMetrics, captionRenderState } from "./captionPlan";
import { assFontSize, layoutPolicyFingerprint, verifiedCaptionFont, SHORTFORM_LAYOUT_POLICY } from "./layoutPolicy";
import { measureOverlayBounds } from "./layoutVerify";

export function motionSubtitleFontPath() { return process.env.NARRATION_SHORTFORM_FONT_FILE || join(process.cwd(), "data/narration-fonts/NotoSansCJKkr-Regular.otf"); }
function assertMotionRenderMetadata(metadata: PreviewOutputMetadata, totalDurationMs: number) {
  // v1 requires mov_text; v2 burns captions and deliberately has no subtitle stream.
  if (metadata.videoCodec !== "h264" || metadata.width !== 720 || metadata.height !== 1280 || !isCompatiblePreviewFps(metadata.frameRate) ||
    !metadata.hasAudio || metadata.audioCodec !== "aac" || metadata.hasSubtitle || Math.abs(metadata.durationMs - totalDurationMs) > VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS) throw new Error("motion_render_metadata_invalid");
}
export function motionRenderConfig() {
  const font = motionSubtitleFontPath(); if (!existsSync(font)) throw new NarrationError("한국어 자막 글꼴이 준비되지 않았습니다.", 503);
  return motionRenderConfigSchema.parse({ renderer: "narration-motion-scenes-v2", width: 720, height: 1280, fps: 30, subtitleMode: "burned_sentence", fontFamily: "Noto Sans CJK KR", fontSha256: sha256FileSync(font),
    fontSize: 38, marginV: 210, marginH: 60, maxLineUnits: 30, maxLines: 4, minFontSize: 26, subtitleTiming: "sentence_start_end", videoCodec: "libx264", audioCodec: "aac", crf: 20, preset: "veryfast", transition: "hard_cut", gapPolicy: "hold_previous_scene", frameBoundary: "round_absolute_endpoints" });
}
export function motionShortformFingerprint(job: Pick<MotionShortformJob, "candidateId" | "plan" | "timeline" | "images" | "motionAssets" | "renderConfig">) {
  return sceneHash({ contract: "narration-shortform-input-v2", candidateId: job.candidateId, planFingerprint: job.plan.fingerprint, timeline: job.timeline, images: job.images,
    motionAssets: job.motionAssets, renderConfig: job.renderConfig });
}
function jobPath(root: string, id: string) { if (!z.string().uuid().safeParse(id).success) throw new NarrationError("렌더 작업 ID를 확인해주세요.", 400); return join(root, "context/narration/shortform-jobs", `${id}.json`); }
export function readMotionShortformJob(root: string, id: string) {
  const job = motionShortformJobSchema.parse(JSON.parse(readFileSync(jobPath(root, id), "utf8")));
  if (job.jobId !== id || job.candidateId !== job.plan.source.candidateId || job.plan.fingerprint !== scenePlanFingerprint(job.plan) || !job.plan.approval || job.plan.approval.fingerprint !== job.plan.fingerprint ||
    job.plan.approval.revision !== job.plan.revision || job.inputFingerprint !== motionShortformFingerprint(job) || job.rendererFingerprint !== sceneHash(job.renderConfig) || (job.status === "completed") !== !!job.output) throw new NarrationError("렌더 작업 연결 정보가 다릅니다.", 409);
  return job;
}
function save(root: string, job: MotionShortformJob) { atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(motionShortformJobSchema.parse(job), null, 2), 0o600); }
function motionInputs(root: string, candidateId: string, planFingerprint: string) {
  const plan = requireFreshScenePlan(root, candidateId, planFingerprint); const source = loadSceneSource(root, candidateId, plan.source.audioJobId);
  const view = motionView(root, candidateId);
  const images = plan.scenes.map(scene => verifySceneAsset(root, plan, scene.visualId).asset);
  const motionAssets = plan.scenes.map(scene => {
    const slot = view.scenes.find(s => s.visualId === scene.visualId);
    if (!slot?.job?.approved || slot.job.status !== "completed") throw new NarrationError("모든 장면의 최신 모션 또는 정지 결과를 먼저 승인해주세요.", 409);
    const { job } = requireMotionOutput(root, candidateId, slot.job.jobId, true);
    return { visualId: scene.visualId, jobId: job.jobId, inputFingerprint: job.inputFingerprint, outputSha256: job.output!.sha256, relativePath: job.output!.relativePath, frameCount: job.output!.frameCount };
  });
  return { candidateId, plan, timeline: source.timeline, images, motionAssets };
}
function currentInputs(root: string, candidateId: string, planFingerprint: string) {
  const inputs = motionInputs(root, candidateId, planFingerprint); const renderConfig = motionRenderConfig();
  renderMotionAss(inputs.timeline, renderConfig); // Reject unreadable subtitles before accepting a job.
  return { ...inputs, renderConfig };
}
function copyRenderInputs(root: string, job: MotionShortformJob | CaptionShortformJob, path: (name: string) => string) {
  const videos = job.motionAssets.map(motion => { const current = requireMotionOutput(root, job.candidateId, motion.jobId, true); const bytes = readFileSync(current.path);
    if (sha256Buffer(bytes) !== motion.outputSha256) throw new Error("motion_changed"); const target = path(`inputs/${motion.visualId}.mp4`); atomicWriteFile(target, bytes); return target; });
  const audio = job.timeline.segments.map(segment => { const bytes = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.relativeAudioPath }));
    if (sha256Buffer(bytes) !== segment.audioSha256) throw new Error("audio_changed"); const target = path(`inputs/${segment.segmentId}.wav`); atomicWriteFile(target, bytes); return target; });
  return { videos, audio };
}
function verifyRenderOutput(root: string, prefix: string, output: NonNullable<MotionShortformJob["output"]>) {
  for (const [relativePath, expected, suffix] of [[output.relativePath, output.sha256, "shortform.mp4"], [output.subtitlesRelativePath, output.subtitlesSha256, "subtitles.srt"], [output.assRelativePath, output.assSha256, "subtitles.ass"]]) {
    if (relativePath !== `${prefix}/${suffix}`) throw new NarrationError("렌더 결과 경로가 다릅니다.", 409);
    const absolute = resolvePackageArtifactPath({ packageRoot: root, relativePath: relativePath! });
    if (!existsSync(absolute) || sha256FileSync(absolute) !== expected) throw new NarrationError("렌더 결과 파일이 없거나 변경되었습니다.", 409);
  }
  const videoPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: output.relativePath });
  if (statSync(videoPath).size !== output.byteSize) throw new NarrationError("렌더 결과 크기가 다릅니다.", 409);
  return { videoPath, subtitlesPath: resolvePackageArtifactPath({ packageRoot: root, relativePath: output.subtitlesRelativePath }) };
}
export function motionShortformFresh(root: string, job: MotionShortformJob) {
  try { return motionShortformFingerprint(currentInputs(root, job.candidateId, job.plan.fingerprint)) === job.inputFingerprint; } catch { return false; }
}
export function motionShortformSourceView(root: string, candidateId: string) {
  const view = motionView(root, candidateId); const approvedCount = view.scenes.filter(s => s.job?.approved && s.job.status === "completed").length;
  let inputFingerprint: string | null = null; let reason: string | null = null; let totalDurationMs: number | null = null;
  try { if (!view.planFingerprint) throw new NarrationError("승인된 문장 비주얼 계획이 필요합니다."); const input = currentInputs(root, candidateId, view.planFingerprint); inputFingerprint = motionShortformFingerprint(input); totalDurationMs = input.timeline.totalDurationMs; }
  catch (error) { reason = error instanceof NarrationError ? error.message : "렌더 입력을 확인해주세요."; }
  return { ready: !!inputFingerprint, workerAvailable: motionWorkerAvailable(), inputFingerprint, planFingerprint: view.planFingerprint, sceneCount: view.scenes.length, approvedCount, totalDurationMs, reason };
}
export function queueMotionShortform(root: string, candidateId: string, planFingerprint: string, expectedInputFingerprint: string) {
  if (!motionWorkerAvailable()) throw new NarrationError("영상 실행기가 연결되지 않았습니다.", 503);
  return withSceneLock(root, () => {
    const inputs = currentInputs(root, candidateId, planFingerprint); const fingerprint = motionShortformFingerprint(inputs);
    if (fingerprint !== expectedInputFingerprint) throw new NarrationError("렌더 입력이 변경되었습니다. 다시 불러와주세요.", 409);
    const publish = (job: MotionShortformJob) => atomicWriteFile(join(motionQueueDirectory(), `${job.jobId}.json`), JSON.stringify({ kind: "shortform-v2", root, jobId: job.jobId, createdAt: job.createdAt, order: 0 }), 0o600);
    const index = join(root, "context/narration/shortform-jobs/motion-current.json");
    if (existsSync(index)) {
      try { const previous = readMotionShortformJob(root, JSON.parse(readFileSync(index, "utf8")).jobId);
        if (previous.inputFingerprint === fingerprint && ["queued", "running", "completed"].includes(previous.status) && motionShortformFresh(root, previous)) {
          if (previous.status === "completed") requireMotionShortformOutput(root, candidateId, previous.jobId);
          if (previous.status === "queued") publish(previous);
          return previous;
        }
      } catch { /* Recover missing/corrupt previous output with a new job. */ }
    }
    const job: MotionShortformJob = { contract: "narration-shortform-render-job-v2", jobId: randomUUID(), ...inputs, inputFingerprint: fingerprint,
      rendererFingerprint: sceneHash(inputs.renderConfig), createdAt: new Date().toISOString(), startedAt: null, heartbeatAt: null, status: "queued", errorCode: null, output: null };
    save(root, job); atomicWriteFile(index, JSON.stringify({ jobId: job.jobId }), 0o600); publish(job); return job;
  });
}
export async function runMotionShortform(root: string, jobId: string) {
  let job = readMotionShortformJob(root, jobId); if (!["queued", "running"].includes(job.status)) return job;
  if (!motionShortformFresh(root, job)) { job.status = "stale"; save(root, job); return job; }
  job = { ...job, status: "running", startedAt: job.startedAt ?? new Date().toISOString(), heartbeatAt: new Date().toISOString(), errorCode: null }; save(root, job);
  const heartbeat = setInterval(() => { job.heartbeatAt = new Date().toISOString(); save(root, job); }, 10_000);
  try {
    const prefix = `reel/narration-motion-render/${job.inputFingerprint}/${jobId}`;
    const path = (name: string) => resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/${name}` });
    const { videos, audio } = copyRenderInputs(root, job, path);
    const font = readFileSync(motionSubtitleFontPath()); if (sha256Buffer(font) !== job.renderConfig.fontSha256) throw new Error("font_changed");
    const fontPath = path("fonts/NotoSansCJKkr-Regular.otf"); atomicWriteFile(fontPath, font);
    const ass = renderMotionAss(job.timeline, job.renderConfig); const srt = renderSrtFromTimeline(job.timeline);
    atomicWriteFile(path("subtitles.ass"), ass); atomicWriteFile(path("subtitles.srt"), srt);
    if (!motionShortformFresh(root, job)) { job.status = "stale"; return job; }
    await runFfmpeg({ args: buildMotionShortformArgs({ job, videos, audio, assPath: path("subtitles.ass"), fontDirectory: dirname(fontPath), outputPath: path("shortform.mp4") }), timeoutMs: 30 * 60_000 });
    const metadata = await createFfprobePreviewOutputProbe().probePreview(path("shortform.mp4")); assertMotionRenderMetadata(metadata, job.timeline.totalDurationMs);
    if (!motionShortformFresh(root, job)) { job.status = "stale"; return job; }
    job = { ...job, status: "completed", output: { relativePath: `${prefix}/shortform.mp4`, sha256: sha256FileSync(path("shortform.mp4")), byteSize: statSync(path("shortform.mp4")).size,
      subtitlesRelativePath: `${prefix}/subtitles.srt`, subtitlesSha256: sha256Buffer(srt), assRelativePath: `${prefix}/subtitles.ass`, assSha256: sha256Buffer(ass), measuredDurationMs: metadata.durationMs, width: 720, height: 1280, fps: 30 } };
    return job;
  } catch { job = { ...job, status: motionShortformFresh(root, job) ? "failed" : "stale", errorCode: "motion_render_failed", output: null }; return job; }
  finally { clearInterval(heartbeat); save(root, job); }
}
export function requireMotionShortformOutput(root: string, candidateId: string, id: string) {
  const job = readMotionShortformJob(root, id);
  if (job.candidateId !== candidateId || job.status !== "completed" || !job.output || !motionShortformFresh(root, job)) throw new NarrationError("최신 완료 영상이 필요합니다.", 409);
  return { job, output: job.output, ...verifyRenderOutput(root, `reel/narration-motion-render/${job.inputFingerprint}/${id}`, job.output) };
}
export function captionRenderConfig() {
  const metrics = captionFontMetrics();
  return captionRenderConfigSchema.parse({ renderer: "narration-motion-scenes-v3", width: 720, height: 1280, fps: 30, subtitleMode: "burned_caption_cues", fontFamily: SHORTFORM_LAYOUT_POLICY.font.family, fontWeight: "bold",
    fontSha256: metrics.sha256, layoutPolicyId: SHORTFORM_LAYOUT_POLICY.policyId, layoutPolicyFingerprint: layoutPolicyFingerprint(), platformValidation: "pending", captionFontSize: 40, hookFontSize: 48, maxLines: 2,
    fontSizeBasis: SHORTFORM_LAYOUT_POLICY.fontSizeBasis, captionAssFontSize: assFontSize(metrics, "caption"), hookAssFontSize: assFontSize(metrics, "hook"),
    autoShrink: false, previewGuideBurned: false, videoCodec: "libx264", audioCodec: "aac", crf: 20, preset: "veryfast", transition: "hard_cut", gapPolicy: "hold_previous_scene", frameBoundary: "round_absolute_endpoints" });
}
type CaptionPurpose = CaptionShortformJob["purpose"];
type CaptionInputs = Pick<CaptionShortformJob, "candidateId" | "plan" | "timeline" | "images" | "motionAssets" | "renderConfig" | "purpose" | "captionPlan" | "hook" | "audioReview">;
export function captionShortformFingerprint(job: CaptionInputs) {
  return sceneHash({ contract: "narration-shortform-input-v3", candidateId: job.candidateId, planFingerprint: job.plan.fingerprint, timeline: job.timeline, images: job.images,
    motionAssets: job.motionAssets, renderConfig: job.renderConfig, purpose: job.purpose, captionPlan: job.captionPlan, hook: job.hook, audioReview: job.audioReview });
}
const overlayHook = (hook: CaptionShortformJob["hook"]) => hook?.enabled ? { text: hook.text, startMs: 0, endMs: hook.endMs } : null;
/** Re-run at queue time, at every worker freshness check and when serving output; the UI is never the only gate. */
function captionInputs(root: string, candidateId: string, planFingerprint: string, purpose: CaptionPurpose): CaptionInputs {
  const inputs = motionInputs(root, candidateId, planFingerprint); const caption = captionRenderState(root, candidateId);
  if (!caption.plan || !(purpose === "final" ? caption.finalReady : caption.previewReady)) throw new NarrationError(caption.reason ?? "자막 cue를 확인해주세요.", 409);
  if (caption.plan.lineage.audioJobId !== inputs.plan.source.audioJobId || caption.plan.lineage.audioTimelineFingerprint !== inputs.plan.source.timelineFingerprint) throw new NarrationError("자막 cue와 장면 계획의 음성 기준이 다릅니다.", 409);
  const audio = readNarrationAudioJob(root, inputs.plan.source.audioJobId); const review = audioReviewState(root, audio);
  if (purpose === "final" && review.pending.length) throw new NarrationError(audioReviewPendingMessage(audio, review.pending), 409);
  const firstSceneEndMs = inputs.plan.scenes[0]!.sceneEndMs; const state = openingHookRenderState(root, candidateId, firstSceneEndMs);
  if (purpose === "final" && !state.finalReady) throw new NarrationError(state.reason ?? "도입 문구 승인이 필요합니다.", 409);
  const hook = state.hook && state.previewUsable ? { fingerprint: state.hook.fingerprint, contentFingerprint: state.hook.contentFingerprint, revision: state.hook.revision, approved: openingHookApproved(state.hook),
    enabled: state.hook.enabled, text: state.hook.text, startMs: 0 as const, endMs: Math.min(state.hook.durationMs, firstSceneEndMs), templateId: state.hook.templateId } : null;
  const renderConfig = captionRenderConfig();
  renderCaptionAss({ cues: caption.plan.cues, hook: overlayHook(hook), metrics: captionFontMetrics() }); // Reject unplaceable overlays before accepting a job.
  const audioReview = purpose === "final" ? review.approvals.map(a => ({ sentenceId: a.sentenceId, rawSha256: a.rawSha256, processedSha256: a.processedSha256, policyFingerprint: a.policyFingerprint })) : [];
  return { ...inputs, renderConfig, purpose, captionPlan: { fingerprint: caption.plan.fingerprint, revision: caption.plan.revision, approved: captionApproved(caption.plan), cues: caption.plan.cues }, hook, audioReview };
}
export function readCaptionShortformJob(root: string, id: string) {
  const job = captionShortformJobSchema.parse(JSON.parse(readFileSync(jobPath(root, id), "utf8")));
  if (job.jobId !== id || job.candidateId !== job.plan.source.candidateId || job.plan.fingerprint !== scenePlanFingerprint(job.plan) || !job.plan.approval || job.plan.approval.fingerprint !== job.plan.fingerprint ||
    job.plan.approval.revision !== job.plan.revision || job.inputFingerprint !== captionShortformFingerprint(job) || job.rendererFingerprint !== sceneHash(job.renderConfig) || (job.status === "completed") !== !!job.output ||
    (job.purpose === "final" && (!job.captionPlan.approved || job.captionPlan.cues.some(c => !c.reviewed) || !job.hook?.approved))) throw new NarrationError("렌더 작업 연결 정보가 다릅니다.", 409);
  return job;
}
function saveCaption(root: string, job: CaptionShortformJob) { atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(captionShortformJobSchema.parse(job), null, 2), 0o600); }
export function captionShortformFresh(root: string, job: CaptionShortformJob) {
  try { return captionShortformFingerprint(captionInputs(root, job.candidateId, job.plan.fingerprint, job.purpose)) === job.inputFingerprint; } catch { return false; }
}
export function captionShortformSourceView(root: string, candidateId: string) {
  const view = motionView(root, candidateId); const approvedCount = view.scenes.filter(s => s.job?.approved && s.job.status === "completed").length;
  const result = { preview: { inputFingerprint: null as string | null, reason: null as string | null }, final: { inputFingerprint: null as string | null, reason: null as string | null } }; let totalDurationMs: number | null = null;
  for (const purpose of ["preview", "final"] as const) {
    try { if (!view.planFingerprint) throw new NarrationError("승인된 문장 비주얼 계획이 필요합니다."); const input = captionInputs(root, candidateId, view.planFingerprint, purpose);
      result[purpose].inputFingerprint = captionShortformFingerprint(input); totalDurationMs = input.timeline.totalDurationMs; }
    catch (error) { result[purpose].reason = error instanceof NarrationError ? error.message : "렌더 입력을 확인해주세요."; }
  }
  return { ...result, workerAvailable: motionWorkerAvailable(), planFingerprint: view.planFingerprint, sceneCount: view.scenes.length, approvedCount, totalDurationMs,
    layout: { policyId: SHORTFORM_LAYOUT_POLICY.policyId, platformValidation: SHORTFORM_LAYOUT_POLICY.platformValidation, boxes: SHORTFORM_LAYOUT_POLICY.boxes, textCenterX: SHORTFORM_LAYOUT_POLICY.textCenterX } };
}
export function queueCaptionShortform(root: string, candidateId: string, planFingerprint: string, expectedInputFingerprint: string, purpose: CaptionPurpose) {
  if (!motionWorkerAvailable()) throw new NarrationError("영상 실행기가 연결되지 않았습니다.", 503);
  return withSceneLock(root, () => {
    const inputs = captionInputs(root, candidateId, planFingerprint, purpose); const fingerprint = captionShortformFingerprint(inputs);
    if (fingerprint !== expectedInputFingerprint) throw new NarrationError("렌더 입력이 변경되었습니다. 다시 불러와주세요.", 409);
    const publish = (job: CaptionShortformJob) => atomicWriteFile(join(motionQueueDirectory(), `${job.jobId}.json`), JSON.stringify({ kind: "shortform-v3", root, jobId: job.jobId, createdAt: job.createdAt, order: 0 }), 0o600);
    const index = join(root, `context/narration/shortform-jobs/caption-${purpose}-current.json`);
    if (existsSync(index)) {
      try { const previous = readCaptionShortformJob(root, JSON.parse(readFileSync(index, "utf8")).jobId);
        if (previous.inputFingerprint === fingerprint && ["queued", "running", "completed"].includes(previous.status) && captionShortformFresh(root, previous)) {
          if (previous.status === "completed") requireCaptionShortformOutput(root, candidateId, previous.jobId);
          if (previous.status === "queued") publish(previous);
          return previous;
        }
      } catch { /* Recover missing/corrupt previous output with a new job. */ }
    }
    const job: CaptionShortformJob = { contract: "narration-shortform-render-job-v3", jobId: randomUUID(), ...inputs, inputFingerprint: fingerprint,
      rendererFingerprint: sceneHash(inputs.renderConfig), createdAt: new Date().toISOString(), startedAt: null, heartbeatAt: null, status: "queued", errorCode: null, output: null };
    saveCaption(root, job); atomicWriteFile(index, JSON.stringify({ jobId: job.jobId }), 0o600); publish(job); return job;
  });
}
export async function runCaptionShortform(root: string, jobId: string) {
  let job = readCaptionShortformJob(root, jobId); if (!["queued", "running"].includes(job.status)) return job;
  // A job recorded under another layout policy is never re-rendered with the current size rule.
  if (job.renderConfig.layoutPolicyId !== SHORTFORM_LAYOUT_POLICY.policyId) { job.status = "stale"; saveCaption(root, job); return job; }
  let font: Buffer;
  // Checked before freshness so a missing or substituted font is a visible failure, not a silent stale.
  try { font = verifiedCaptionFont().bytes; if (sha256Buffer(font) !== job.renderConfig.fontSha256) throw new Error("font_changed"); }
  catch { job = { ...job, status: "failed", errorCode: "caption_font_invalid", output: null }; saveCaption(root, job); return job; }
  if (!captionShortformFresh(root, job)) { job.status = "stale"; saveCaption(root, job); return job; }
  job = { ...job, status: "running", startedAt: job.startedAt ?? new Date().toISOString(), heartbeatAt: new Date().toISOString(), errorCode: null }; saveCaption(root, job);
  const heartbeat = setInterval(() => { job.heartbeatAt = new Date().toISOString(); saveCaption(root, job); }, 10_000);
  let errorCode = "motion_render_failed";
  try {
    const prefix = `reel/narration-motion-render/${job.inputFingerprint}/${jobId}`;
    const path = (name: string) => resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/${name}` });
    const { videos, audio } = copyRenderInputs(root, job, path);
    const fontPath = path(`fonts/${SHORTFORM_LAYOUT_POLICY.font.file}`); atomicWriteFile(fontPath, font); const metrics = captionFontMetrics();
    const hook = overlayHook(job.hook); const ass = renderCaptionAss({ cues: job.captionPlan.cues, hook, metrics }); const srt = renderCaptionSrt(job.captionPlan.cues, metrics);
    atomicWriteFile(path("subtitles.ass"), ass); atomicWriteFile(path("subtitles.srt"), srt);
    const items = [...(hook ? [{ kind: "hook" as const, text: hook.text }] : []), ...job.captionPlan.cues.map(c => ({ kind: "caption" as const, text: c.text }))];
    const layoutDirectory = path("layout-check");
    try { if ((await measureOverlayBounds({ items, metrics, fontDirectory: dirname(fontPath), workDirectory: layoutDirectory })).some(item => !item.inside)) { errorCode = "caption_layout_overflow"; throw new Error(errorCode); } }
    finally { rmSync(layoutDirectory, { recursive: true, force: true }); }
    if (!captionShortformFresh(root, job)) { job.status = "stale"; return job; }
    await runFfmpeg({ args: buildMotionShortformArgs({ job, videos, audio, assPath: path("subtitles.ass"), fontDirectory: dirname(fontPath), outputPath: path("shortform.mp4") }), timeoutMs: 30 * 60_000 });
    const metadata = await createFfprobePreviewOutputProbe().probePreview(path("shortform.mp4")); assertMotionRenderMetadata(metadata, job.timeline.totalDurationMs);
    if (!captionShortformFresh(root, job)) { job.status = "stale"; return job; }
    job = { ...job, status: "completed", output: { relativePath: `${prefix}/shortform.mp4`, sha256: sha256FileSync(path("shortform.mp4")), byteSize: statSync(path("shortform.mp4")).size,
      subtitlesRelativePath: `${prefix}/subtitles.srt`, subtitlesSha256: sha256Buffer(srt), assRelativePath: `${prefix}/subtitles.ass`, assSha256: sha256Buffer(ass), measuredDurationMs: metadata.durationMs, width: 720, height: 1280, fps: 30, layoutCheckedItems: items.length } };
    return job;
  } catch { job = { ...job, status: captionShortformFresh(root, job) ? "failed" : "stale", errorCode, output: null }; return job; }
  finally { clearInterval(heartbeat); saveCaption(root, job); }
}
export function requireCaptionShortformOutput(root: string, candidateId: string, id: string) {
  const job = readCaptionShortformJob(root, id);
  if (job.candidateId !== candidateId || job.status !== "completed" || !job.output || !captionShortformFresh(root, job)) throw new NarrationError("최신 완료 영상이 필요합니다.", 409);
  return { job, output: job.output, ...verifyRenderOutput(root, `reel/narration-motion-render/${job.inputFingerprint}/${id}`, job.output) };
}
/** The preview a reviewer watched before one-step caption approval: completed, intact, still fresh, rendered from exactly this caption plan. */
export function requireCaptionPreviewFor(root: string, candidateId: string, id: string, captionPlanFingerprint: string) {
  const { job } = requireCaptionShortformOutput(root, candidateId, id);
  if (job.purpose !== "preview" || job.captionPlan.fingerprint !== captionPlanFingerprint) throw new NarrationError("현재 자막 cue로 만든 미리보기 영상을 먼저 확인해주세요.", 409);
}
export function currentCaptionPreviewJobId(root: string, candidateId: string, captionPlanFingerprint: string | null) {
  const index = join(root, "context/narration/shortform-jobs/caption-preview-current.json"); if (!captionPlanFingerprint || !existsSync(index)) return null;
  try { const id = (JSON.parse(readFileSync(index, "utf8")) as { jobId: string }).jobId; requireCaptionPreviewFor(root, candidateId, id, captionPlanFingerprint); return id; } catch { return null; }
}
