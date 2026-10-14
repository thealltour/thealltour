// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import { generateNarrationMasterTimeline } from "@/lib/marketing/tts/timeline/orchestrate";
import { analyzeEdges, parsePcmWav, sliceWav } from "@/lib/marketing/tts/audioProcessing/trimEdges";
import { EDGE_TRIM_POLICY, edgeTrimPolicyFingerprint, type EdgeTrimPolicy } from "@/lib/marketing/tts/audioProcessing/contracts";
import { narrationLineage, mutateNarration } from "../../narration/persistence";
import { applyEdgeRanges, audioConfigFingerprint, edgeReviewView, latestNarrationAudioJob, processedAudioFingerprint, processingPolicyOutdated, queueNarrationAudio, readNarrationAudioJob, reprocessNarrationAudio, runNarrationAudioJob, type NarrationAudioJob, type ProcessedNarrationAudioJob } from "../../narration/audio";
import { approveKeepRawRange, audioReviewState } from "../../narration/audioReview";
import { currentFirstSceneEndMs, hookDisplayIssue, mutateOpeningHook, openingHookApproved, openingHookRenderState, readOpeningHook } from "../../narration/openingHook";
import { buildSceneHandoff, mutateScenePlan, readScenePlan, sceneHash, scenePlanFresh } from "../../narrationScenes/service";
import { uploadSceneAsset } from "../../narrationScenes/assets";
import { approveMotionJobs, motionJobFresh, queueMotionJobs, readMotionJob, saveMotionSettings, writeMotionJob } from "../../narrationMotion/service";
import { motionFrameLayout } from "../../narrationMotion/frameLayout";
import { bulkApproveCaptionPlan, captionAttention, captionFingerprint, captionFontMetrics, captionRenderState, mutateCaptionPlan, proposeSentenceRanges, readCaptionPlan, validateCaptionCues } from "../captionPlan";
import { alignmentInputFingerprint, alignmentInputs, alignmentView, queueCaptionAlignment, runCaptionAlignment, usableAlignment } from "../captionAlignment";
import { assFontSize, captionFontPath, layoutBox, textStyle, wrapTextLines } from "../layoutPolicy";
import { lineHeightPx, renderedEmPx, textWidthPx } from "../fontMetrics";
import { measureOverlayBounds } from "../layoutVerify";
import { renderCaptionAss, renderCaptionSrt } from "../motionSubtitles";
import { captionShortformFingerprint, captionShortformFresh, captionShortformSourceView, queueCaptionShortform, queueMotionShortform, readCaptionShortformJob, requireCaptionPreviewFor, requireCaptionShortformOutput, runCaptionShortform } from "../motionService";
import { readCompatibleShortform } from "../compatible";

const policy = vi.hoisted(() => ({ override: null as EdgeTrimPolicy | null }));
vi.mock("@/lib/marketing/tts/audioProcessing/contracts", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/marketing/tts/audioProcessing/contracts")>();
  return { ...actual, currentEdgeTrimPolicy: () => policy.override ?? actual.currentEdgeTrimPolicy() };
});

const SR = 16000; const LEAD_MS = 600; const LONG_LEAD_MS = 1800; const TAIL_MS = 700; const PAUSE_MS = 300;
const speechMs = (text: string) => Math.max(600, Math.round([...text].length * 9) * 10);
/** 16-bit mono WAV: leading silence, tone, internal 300ms pause, tone, trailing silence. */
function toneWav(text: string, lead = LEAD_MS) {
  const speech = speechMs(text); const total = (lead + speech + TAIL_MS) * SR / 1000; const tone = (speech - PAUSE_MS) / 2;
  const audio = Buffer.alloc(44 + total * 2); audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(SR, 24); audio.writeUInt32LE(SR * 2, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) { const ms = i * 1000 / SR - lead; const voiced = (ms >= 0 && ms < tone) || (ms >= tone + PAUSE_MS && ms < speech); audio.writeInt16LE(voiced ? Math.round(Math.sin(2 * Math.PI * 220 * i / SR) * 0.3 * 32767) : 0, 44 + i * 2); }
  return audio;
}
/** Short first sentence (first scene < 3s once trimmed), a long one that needs several cues, and one whose 1.8s lead makes trimming review_required. */
const SENTENCES = ["운영 시간은 공식 안내를 먼저 확인하세요.", "제주 동쪽 해안도로는 봄철 주말마다 차량이 많아, 이른 아침에 출발하면 성산일출봉 주변 주차장을 비교적 여유 있게 이용할 수 있습니다.", "출발 전에 날씨와 도로 통제 소식을 함께 보세요."];
const leadFor = (text: string) => text === SENTENCES[2] ? LONG_LEAD_MS : LEAD_MS;
const HOOK = "출발 전 꼭 확인할 세 가지";
const MIXED_SENTENCE = "Jeju Olle 7코스는 2026년 3월 1일(일)부터 09:00~18:00 운영하며, 입장료는 1,500원입니다!";
const MIXED_HOOK = "Olle 7코스, 3월 1일부터 운영!";
const candidateId = "caption-test";
let root: string; let queue: string; let canonical: CanonicalMarketingAsset;
const lineage = () => narrationLineage(canonical, root);
const generate = vi.fn();
const provider = (profileId: string): TtsProvider => ({ providerId: "voicestudio", generate: async input => {
  generate(input.segmentId); const audio = toneWav(input.text, leadFor(input.text));
  return { contract: "tts-generation-result-v1" as const, requestId: input.requestId, provider: "voicestudio" as const, profileId, mediaType: "audio/wav" as const, format: "wav" as const, sampleRate: SR, channels: 1,
    byteSize: audio.length, sha256: sha256Buffer(audio), providerGenerationId: null, providerReportedDurationMs: null, containerDurationMs: null, timelineAuthoritative: false as const,
    generatedAt: new Date().toISOString(), segmentId: input.segmentId ?? null, metadata: { modelRef: "m", voiceRef: "v", httpStatus: 200 }, audio };
} });
let audio: ProcessedNarrationAudioJob;
let profile: ReturnType<typeof resolveTtsProfile>;
let narrationView: ReturnType<typeof mutateNarration>;
const health = () => writeFileSync(join(queue, "health.json"), JSON.stringify({ heartbeatAt: new Date().toISOString(), pid: 1 }));
const fileCount = (path: string) => existsSync(path) ? readdirSync(path).length : 0;

async function buildScenesAndMotion() {
  const input = { audioJobId: audio.jobId, expectedNarrationRevision: narrationView.revision, expectedNarrationFingerprint: narrationView.fingerprint };
  const saved = mutateScenePlan(root, candidateId, { action: "save", ...input, expectedRevision: null, expectedFingerprint: null, prompts: narrationView.sentences.map(s => ({ sentenceId: s.sentenceId, visualPrompt: "해안도로를 달리는 차" })) }).plan;
  const plan = mutateScenePlan(root, candidateId, { action: "approve", ...input, expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint }).plan;
  mutateScenePlan(root, candidateId, { action: "handoff", ...input, expectedRevision: plan.revision, expectedFingerprint: plan.fingerprint });
  const handoff = buildSceneHandoff(plan);
  for (const [i, scene] of plan.scenes.entries()) {
    const bytes = await sharp({ create: { width: 90, height: 160, channels: 3, background: { r: 40 + i * 60, g: 90, b: 120 } } }).png().toBuffer();
    await uploadSceneAsset({ root, candidateId, visualId: scene.visualId, bytes, planFingerprint: plan.fingerprint, handoffFingerprint: handoff.fingerprint });
  }
  const settings = saveMotionSettings(root, candidateId, plan.fingerprint, null, plan.scenes.map(s => ({ visualId: s.visualId, choice: { preset: "static" as const, strength: "low" as const } })));
  health(); const jobs = queueMotionJobs(root, candidateId, plan.fingerprint, settings.fingerprint, plan.scenes.map(s => s.visualId));
  for (const [i, job] of jobs.entries()) {
    // Stand-in for the mini-PC motion worker output only; the job contract and approval path are the real ones.
    const frames = job.source.endFrame - job.source.startFrame; const prefix = `media/narration-motion/${job.inputFingerprint}/${job.jobId}`;
    const video = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/scene.mp4` }); mkdirSync(dirname(video), { recursive: true });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${(0x305070 + i * 0x202000).toString(16)}:s=720x1280:r=30`, "-frames:v", String(frames), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", video]);
    const manifest = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/execution.json` }); writeFileSync(manifest, "{}");
    writeMotionJob(root, { ...job, status: "completed", startedAt: job.createdAt, heartbeatAt: job.createdAt, completedAt: new Date().toISOString(), output: { relativePath: `${prefix}/scene.mp4`, sha256: sha256FileSync(video),
      byteSize: statSync(video).size, width: 720, height: 1280, fps: 30, frameCount: frames, durationMs: Math.round(frames * 1000 / 30), manifestRelativePath: `${prefix}/execution.json`, manifestSha256: sha256FileSync(manifest) } });
  }
  approveMotionJobs(root, candidateId, plan.fingerprint, settings.fingerprint, jobs.map(j => ({ jobId: j.jobId, expectedOutputSha256: readMotionJob(root, j.jobId).output!.sha256 })));
  return plan;
}
function reviewAll() {
  const plan = readCaptionPlan(root, candidateId)!;
  const saved = mutateCaptionPlan(root, candidateId, { action: "save", expectedRevision: plan.revision, expectedFingerprint: plan.fingerprint, cues: plan.cues.map(c => ({ sentenceId: c.sentenceId, text: c.text, startMs: c.startMs, endMs: c.endMs, reviewed: true })) });
  return mutateCaptionPlan(root, candidateId, { action: "approve", expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint });
}
function hook(text: string, enabled = true, options: { durationMs?: number; sources?: string[] } = {}) {
  const current = readOpeningHook(root, candidateId);
  const saved = mutateOpeningHook(root, candidateId, { action: "save", expectedRevision: current?.revision ?? null, expectedFingerprint: current?.fingerprint ?? null, text, enabled,
    sourceSentenceIds: options.sources ?? [narrationView.sentences[0]!.sentenceId], durationMs: options.durationMs ?? 2000 });
  return { saved, approve: () => mutateOpeningHook(root, candidateId, { action: "approve", expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint }) };
}
const motionFresh = () => readScenePlan(root)!.scenes.every(scene => motionJobFresh(root, readMotionJob(root, JSON.parse(readFileSync(join(root, "context/narration/motion/jobs-current.json"), "utf8"))[scene.visualId])));
const reviewSegment = () => audio.processing.segments.find(s => s.status === "review_required")!;
const approvalMutation = (segment: ProcessedNarrationAudioJob["processing"]["segments"][number], overrides: Partial<{ expectedRawSha256: string; expectedProcessedSha256: string }> = {}) =>
  ({ action: "approve-keep-raw" as const, audioJobId: audio.jobId, sentenceId: segment.segmentId, expectedRawSha256: segment.rawSha256, expectedProcessedSha256: segment.processedSha256!, ...overrides });
type AlignRequest = { jobId: string; inputFingerprint: string; config: { runnerSha256: string; modelId: string; modelSha256: string }; sentences: { sentenceId: string; audioSha256: string; audioBase64: string; units: { readings: string[] }[] }[] };
/** Stand-in for the mini-PC runner (real output is covered by captionAlignment.test.ts): every unit spoken at evenly spaced syllable onsets; `mishear` sentences sound like something else. */
function fakeAligner(mishear: Set<string>) {
  const calls: string[] = [];
  const execute = async (payload: string) => {
    const request = JSON.parse(payload) as AlignRequest; calls.push(request.jobId);
    return JSON.stringify({ contract: "narration-caption-align-output-v1", jobId: request.jobId, inputFingerprint: request.inputFingerprint, runnerSha256: request.config.runnerSha256, modelId: request.config.modelId,
      modelSha256: request.config.modelSha256, torchVersion: "test", transformersVersion: "test", numpyVersion: "test", device: "cpu", threads: 4, modelLoadMs: 1, elapsedMs: 1,
      sentences: request.sentences.map(s => {
        const frameCount = parsePcmWav(Buffer.from(s.audioBase64, "base64")).frameCount; const durationMs = Math.floor(frameCount * 1000 / SR / 20) * 20;
        const picks = s.units.map(u => u.readings.findIndex(r => r && !r.includes("*"))); const spoken = picks.map((r, i) => s.units[i]!.readings[r]!.replace(/\s/g, ""));
        const step = Math.floor((durationMs - 200) / spoken.join("").length / 20) * 20; let at = 100;
        const units = spoken.map((reading, i) => { const onsetsMs = [...reading].map(() => { const v = at; at += step; return v; });
          return { index: i, reading: picks[i], spoken: true, startMs: onsetsMs[0], endMs: at, labelFrames: onsetsMs.length, onsetsMs, heard: mishear.has(s.sentenceId) ? "가".repeat(onsetsMs.length) : reading }; });
        return { sentenceId: s.sentenceId, audioSha256: s.audioSha256, sampleRate: SR, sampleCount: frameCount, frameMs: 20, status: "aligned", frames: durationMs / 20, greedy: units.map(u => u.heard).join(" "),
          speechFrameRatio: 0.1, freeLogProbPerFrame: -0.05, forcedLogProbPerFrame: -0.06, units, oovSyllables: [], elapsedMs: 1 };
      }) });
  };
  return { calls, execute };
}

const hasFfmpeg = ["ffmpeg", "ffprobe"].every(tool => spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0);
describe.skipIf(!hasFfmpeg)("shortform caption cues, edge-silence processing and opening hook", () => {
  let planFingerprint: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "caption-shortform-")); queue = join(root, ".queue"); mkdirSync(queue, { recursive: true });
    vi.stubEnv("VOICESTUDIO_BASE_URL", "http://127.0.0.1:13900"); vi.stubEnv("NARRATION_TTS_PROFILE_JSON", ""); vi.stubEnv("NARRATION_MOTION_QUEUE_DIR", queue);
    canonical = { contract: "canonical-marketing-asset-v1", assetId: "cma-caption", version: 1, status: "approved", agendaId: "agenda", storyPointId: "story", storyPointHash: "story-hash", evidenceBriefRef: null,
      evidenceRevision: "evidence-v1", contentPropositionRef: null, propositionRevision: "proposition-v1", sourceRevision: "source-v1", titleKo: "제주 동쪽 여행", dekKo: null, openingHookKo: "출발 조건을 확인합니다.",
      bodyKo: "일정과 조건을 확인합니다.", keyTakeawaysKo: [], decisionGuidanceKo: "공식 안내를 확인합니다.", optionalCtaIntentKo: null, evidenceRefs: [], limitationsKo: [], forbiddenClaimsKo: [],
      supportedClaimBoundaryKo: null, unresolvedQuestionsKo: [], storySupportVerdict: null, generatedAt: "2026-10-03T00:00:00.000Z", editedAt: null, approvedAt: "2026-10-03T00:00:00.000Z", approvedVersion: 1,
      humanEdited: false, approvalSource: "ai_original", approvedBy: "human", generatedBy: "test", repairCount: 0, validationIssues: [] };
    persistCanonicalAssetToPackage({ packageRoot: root, asset: canonical });
    const draft = mutateNarration(root, candidateId, { action: "save", expectedRevision: null, expectedFingerprint: null, lineage: lineage(), sentences: SENTENCES.map(text => ({ sentenceId: null, text, purpose: null })) }, lineage);
    narrationView = mutateNarration(root, candidateId, { action: "approve", expectedRevision: draft.revision, expectedFingerprint: draft.fingerprint, lineage: lineage() }, lineage);
    profile = resolveTtsProfile("standard-ko-development");
    const job = queueNarrationAudio({ root, candidateId, expectedRevision: narrationView.revision, expectedFingerprint: narrationView.fingerprint, lineage: lineage(), profile, endpointIdentity: "http://127.0.0.1:13900" });
    const done: NarrationAudioJob = await runNarrationAudioJob({ root, jobId: job.jobId, provider: provider(profile.profileId), durationProbe: createFfprobeDurationProbe(), profile, endpointIdentity: "http://127.0.0.1:13900", getLineage: lineage });
    if (done.contract !== "narration-audio-job-v2") throw new Error("v2 expected"); audio = done;
    planFingerprint = (await buildScenesAndMotion()).fingerprint;
  }, 240_000);
  afterAll(() => { policy.override = null; rmSync(root, { recursive: true, force: true }); vi.unstubAllEnvs(); });

  it("edge trim writes new immutable WAVs, keeps raw SHA, internal pauses and 250ms gaps; long silence stays raw as review_required", () => {
    expect(audio.status).toBe("completed"); expect(audio.processing.policy).toEqual(EDGE_TRIM_POLICY); expect(audio.processing.policyFingerprint).toBe(edgeTrimPolicyFingerprint(EDGE_TRIM_POLICY));
    for (const [i, segment] of audio.timeline!.segments.entries()) {
      const processed = audio.processing.segments[i]!; const raw = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: processed.rawRelativePath })); const lead = leadFor(SENTENCES[i]!);
      expect(sha256Buffer(raw)).toBe(processed.rawSha256); expect(raw.equals(toneWav(SENTENCES[i]!, lead))).toBe(true); expect(processed.rawRelativePath).not.toBe(segment.relativeAudioPath);
      if (lead === LONG_LEAD_MS) {
        expect(processed.status).toBe("review_required"); expect(processed.diagnostics).toContain("leading_trim_exceeds_1500ms");
        expect([processed.removedLeadingMs, processed.removedTrailingMs]).toEqual([0, 0]); expect(segment.durationMs).toBe(LONG_LEAD_MS + speechMs(SENTENCES[i]!) + TAIL_MS);
      } else {
        expect(processed.status).toBe("ready"); expect(processed.removedLeadingMs).toBe(LEAD_MS - 80); expect(processed.removedTrailingMs).toBe(TAIL_MS - 120);
        expect(segment.durationMs).toBe(speechMs(SENTENCES[i]!) + 200); // internal 300ms pause retained
      }
      const wav = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.relativeAudioPath }));
      expect(Math.round(parsePcmWav(wav).frameCount * 1000 / SR)).toBe(segment.durationMs); expect(sha256Buffer(wav)).toBe(segment.audioSha256);
      if (i) expect(segment.startMs - audio.timeline!.segments[i - 1]!.endMs).toBe(250);
    }
    expect(processedAudioFingerprint(audio)).toMatch(/^[a-f0-9]{64}$/);
    const silent = Buffer.alloc(44 + SR * 2); toneWav("가").copy(silent, 0, 0, 44); silent.writeUInt32LE(silent.length - 8, 4); silent.writeUInt32LE(SR * 2, 40);
    expect(analyzeEdges(silent, parsePcmWav(silent))).toMatchObject({ status: "review_required", diagnostics: ["no_speech_detected"], keptStartSample: 0, keptEndSampleExclusive: SR });
  });

  it("cues split sentences without changing scene/visual count, order or text", () => {
    const plan = mutateCaptionPlan(root, candidateId, { action: "generate", expectedRevision: null, expectedFingerprint: null });
    const scenes = readScenePlan(root)!;
    expect(scenes.fingerprint).toBe(planFingerprint); expect(scenePlanFresh(root, candidateId, scenes)).toBe(true);
    expect(scenes.scenes.map(s => s.visualId)).toEqual(narrationView.sentences.map(s => s.sentenceId));
    expect(plan.cues.filter(c => c.sentenceId === narrationView.sentences[1]!.sentenceId).length).toBeGreaterThanOrEqual(2);
    for (const sentence of narrationView.sentences) {
      const own = plan.cues.filter(c => c.sentenceId === sentence.sentenceId); const cps = [...sentence.text.replace(/\s+/g, " ").trim()];
      expect(own.map(c => c.text).join(" ")).toBe(cps.join("")); expect(own.at(-1)!.sourceEnd).toBe(cps.length);
      for (const cue of own) expect(cps.slice(cue.sourceStart, cue.sourceEnd).join("").trim()).toBe(cue.text);
    }
    expect(plan.cues.every(c => c.timingSource === "estimated" && !c.reviewed)).toBe(true);
    const state = captionRenderState(root, candidateId); expect(state.previewReady).toBe(true); expect(state.finalReady).toBe(false);
  });

  it("measured libass bounds stay inside caption/hook boxes at 720p and 1080p; overflow fails instead of shrinking", async () => {
    const metrics = captionFontMetrics(); const plan = readCaptionPlan(root, candidateId)!; const work = mkdtempSync(join(root, "layout-"));
    const items = [{ kind: "hook" as const, text: HOOK }, ...plan.cues.map(c => ({ kind: "caption" as const, text: c.text }))];
    for (const [width, height] of [[720, 1280], [1080, 1920]] as const) {
      const measured = await measureOverlayBounds({ items, metrics, fontDirectory: dirname(captionFontPath()), workDirectory: work, width, height });
      expect(measured.every(m => m.inside && m.bounds)).toBe(true);
    }
    // If width estimates were wrong, the rendered libass pixels (not the estimate) decide: half-width metrics put one wide line on screen and it leaves the box.
    const underestimating = { ...metrics, advance: (codePoint: number) => metrics.advance(codePoint) / 2 };
    const wideText = "운영시간과휴무일은출발전에공식안내로꼭확인"; expect(wrapTextLines(underestimating, wideText, "caption")).toEqual([wideText]);
    const [wide] = await measureOverlayBounds({ items: [{ kind: "caption", text: wideText }], metrics: underestimating, fontDirectory: dirname(captionFontPath()), workDirectory: work });
    expect(wide!.inside).toBe(false); expect(wide!.bounds!.x1 - wide!.bounds!.x0).toBeGreaterThan(wide!.box.x1 - wide!.box.x0);
    expect(layoutBox("caption")).toEqual({ x0: 86, y0: 614, x1: 562, y1: 768 }); expect(layoutBox("hook")).toEqual({ x0: 86, y0: 282, x1: 562, y1: 435 });
    const tooLong = SENTENCES[1]!; expect(wrapTextLines(metrics, tooLong, "caption")).toBeNull();
    const target = narrationView.sentences[1]!;
    const firstTargetCue = plan.cues.findIndex(c => c.sentenceId === target.sentenceId);
    const saved = mutateCaptionPlan(root, candidateId, { action: "save", expectedRevision: plan.revision, expectedFingerprint: plan.fingerprint, cues: plan.cues.flatMap((c, i): { sentenceId: string; text: string; startMs: number | null; endMs: number | null; reviewed: boolean }[] => c.sentenceId !== target.sentenceId
      ? [{ sentenceId: c.sentenceId, text: c.text, startMs: c.startMs, endMs: c.endMs, reviewed: c.reviewed }] : i === firstTargetCue ? [{ sentenceId: target.sentenceId, text: tooLong, startMs: null, endMs: null, reviewed: false }] : []) });
    expect(captionRenderState(root, candidateId).issues.some(i => i.code === "layout_overflow" && i.severity === "error")).toBe(true);
    expect(() => renderCaptionAss({ cues: saved.cues, hook: null, metrics })).toThrow("나눠");
    mutateCaptionPlan(root, candidateId, { action: "generate", expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint });
  }, 120_000);

  it("em calibration: libass renders the em the width model uses; mixed Korean/Latin/digit/punctuation cues and hook fit with outline and shadow at 720p and 1080p", async () => {
    const metrics = captionFontMetrics(); const work = mkdtempSync(join(root, "calibrate-")); const fontDirectory = dirname(captionFontPath());
    const segment = { ...audio.timeline!.segments[0]!, text: MIXED_SENTENCE, durationMs: 7000, endMs: audio.timeline!.segments[0]!.startMs + 7000 };
    const cps = [...MIXED_SENTENCE]; const cues = proposeSentenceRanges(segment, metrics).map(([a, b]) => cps.slice(a, b).join("").trim()); expect(cues.length).toBeGreaterThanOrEqual(2);
    for (const [width, height] of [[720, 1280], [1080, 1920]] as const) {
      const style = textStyle("caption", width, height); const em = renderedEmPx(metrics, style.fontSize); expect(Math.abs(em - style.fontSize)).toBeLessThan(0.001);
      const run = "가나다라마바사아자차카"; const twoLine = cues.find(c => wrapTextLines(metrics, c, "caption", width, height)!.length === 2) ?? null;
      const [single, double] = await measureOverlayBounds({ items: [{ kind: "caption", text: run }, ...(twoLine ? [{ kind: "caption" as const, text: twoLine }] : [])], metrics, fontDirectory, workDirectory: work, width, height });
      // Ink spans the advance width minus side bearings plus outline/shadow; a size-interpretation mismatch (v1 rendered ≈0.69×) falls far outside this band.
      const predicted = textWidthPx(metrics, run, em); const ink = single!.bounds!.x1 - single!.bounds!.x0;
      expect(ink).toBeLessThanOrEqual(predicted + 2 * style.outline + style.shadow + 2); expect(ink).toBeGreaterThanOrEqual(predicted - 0.15 * em);
      if (double) { const inkHeight = double.bounds!.y1 - double.bounds!.y0; expect(inkHeight).toBeGreaterThan(lineHeightPx(metrics, em)); expect(inkHeight).toBeLessThanOrEqual(2 * lineHeightPx(metrics, em) + 2 * style.outline + style.shadow); }
      const measured = await measureOverlayBounds({ items: [{ kind: "hook", text: MIXED_HOOK }, ...cues.map(text => ({ kind: "caption" as const, text }))], metrics, fontDirectory, workDirectory: work, width, height });
      expect(measured.filter(m => !m.inside)).toEqual([]);
    }
  }, 120_000);

  it("ASS and SRT come from the same cues with identical breaks, no overlap and no zero-length cue", () => {
    const metrics = captionFontMetrics(); const plan = readCaptionPlan(root, candidateId)!;
    const ass = renderCaptionAss({ cues: plan.cues, hook: { text: HOOK, startMs: 0, endMs: 2000 }, metrics }); const srt = renderCaptionSrt(plan.cues, metrics);
    // Design sizes are em; ASS FontSize is em × (usWinAscent+usWinDescent)/unitsPerEm of the pinned font.
    expect(metrics.libassVerticalUnits).toBe(1448); expect(assFontSize(metrics, "caption")).toBe(57.92); expect(assFontSize(metrics, "hook")).toBe(69.504); expect(assFontSize(metrics, "caption", 1080, 1920)).toBe(86.88);
    expect(ass).toContain("Style: Caption,Noto Sans CJK KR,57.92,"); expect(ass).toContain("Style: Hook,Noto Sans CJK KR,69.504,"); expect(ass).not.toMatch(/\\fs\d|\\p\d/);
    const dialogues = ass.split("\n").filter(l => l.startsWith("Dialogue: 0,")); const blocks = srt.trim().split("\n\n");
    expect(dialogues).toHaveLength(plan.cues.length); expect(blocks).toHaveLength(plan.cues.length);
    const cs = (t: string) => { const [h, m, s] = t.split(":"); return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s)) * 100); };
    let previousEnd = -1;
    for (const [i, line] of dialogues.entries()) {
      const [, start, end] = line.split(","); expect(cs(end!)).toBeGreaterThan(cs(start!)); expect(cs(start!)).toBeGreaterThanOrEqual(previousEnd); previousEnd = cs(end!);
      expect(line.split("}").slice(1).join("}").split("\\N")).toEqual(blocks[i]!.split("\n").slice(2));
    }
    const [a, b] = plan.cues; const broken = [{ ...a!, endMs: a!.startMs + 4 }, { ...b!, startMs: a!.startMs + 2 }, ...plan.cues.slice(2)];
    const timeline = readNarrationAudioJob(root, audio.jobId).timeline!;
    const codes = validateCaptionCues(broken, timeline, metrics).map(i => i.code); expect(codes).toContain("zero_length"); expect(codes).toContain("overlap");
  });

  it("verification 1/2: review_required audio blocks final until explicit raw-length approval; preview stays allowed; changed hashes void it at queue and run time", async () => {
    reviewAll(); hook(HOOK).approve(); health();
    const segment = reviewSegment(); const ready = audio.processing.segments.find(s => s.status === "ready")!;
    let view = captionShortformSourceView(root, candidateId);
    expect(view.final.inputFingerprint).toBeNull(); expect(view.final.reason).toContain("원본 길이 유지로 승인"); expect(view.final.reason).toContain("3번째 문장");
    expect(view.preview.inputFingerprint).not.toBeNull();
    expect(() => queueCaptionShortform(root, candidateId, planFingerprint, view.preview.inputFingerprint!, "final")).toThrow("원본 길이 유지");
    expect(() => approveKeepRawRange({ root, candidateId, mutation: approvalMutation(ready) })).toThrow("검토 필요 상태인 문장만");
    expect(() => approveKeepRawRange({ root, candidateId, mutation: approvalMutation(segment, { expectedRawSha256: "0".repeat(64) }) })).toThrow("음성이 바뀌었습니다");
    expect(audioReviewState(root, audio).pending).toEqual([segment.segmentId]);
    const state = approveKeepRawRange({ root, candidateId, mutation: approvalMutation(segment) });
    expect(state.pending).toEqual([]); expect(state.approvals[0]).toMatchObject({ sentenceId: segment.segmentId, rawSha256: segment.rawSha256, processedSha256: segment.processedSha256, policyFingerprint: audio.processing.policyFingerprint });
    view = captionShortformSourceView(root, candidateId); expect(view.final.inputFingerprint).not.toBeNull();
    const job = queueCaptionShortform(root, candidateId, planFingerprint, view.final.inputFingerprint!, "final");
    expect(job.audioReview).toEqual([{ sentenceId: segment.segmentId, rawSha256: segment.rawSha256, processedSha256: segment.processedSha256, policyFingerprint: audio.processing.policyFingerprint }]);
    // An approval for different WAV bytes (as after any audio change) no longer matches: the worker re-checks and refuses before rendering.
    const approvalsPath = join(root, "context/narration/audio-review/approvals.json"); const original = readFileSync(approvalsPath);
    const file = JSON.parse(original.toString("utf8")); file.approvals[0].processedSha256 = "0".repeat(64); writeFileSync(approvalsPath, JSON.stringify(file));
    expect(audioReviewState(root, audio).pending).toEqual([segment.segmentId]); expect(captionShortformSourceView(root, candidateId).final.inputFingerprint).toBeNull();
    const ran = await runCaptionShortform(root, job.jobId); expect(ran.status).toBe("stale"); expect(ran.output).toBeNull();
    writeFileSync(approvalsPath, original); expect(audioReviewState(root, audio).pending).toEqual([]);
  }, 120_000);

  it("verification 6: hook text edits create no TTS, image or motion jobs; empty text is never approved; 'not used' is explicit", () => {
    const counts = () => ({ tts: generate.mock.calls.length, audioJobs: fileCount(join(root, "context/narration/audio-jobs")), queue: fileCount(queue), motionJobs: fileCount(join(root, "context/narration/motion/jobs")),
      plan: sha256FileSync(join(root, "context/narration/scenes/current.json")), motionIndex: sha256FileSync(join(root, "context/narration/motion/jobs-current.json")), images: fileCount(join(root, "media/narration-scenes", planFingerprint)) });
    const before = counts(); const approvedInput = captionShortformSourceView(root, candidateId).final.inputFingerprint; expect(approvedInput).not.toBeNull();
    expect(() => hook("", true)).toThrow("직접 입력"); expect(() => hook("   ", true)).toThrow("직접 입력"); expect(() => hook(HOOK, true, { sources: [] })).toThrow("근거");
    const disabled = hook("", false); expect(openingHookApproved(disabled.saved)).toBe(false);
    expect(captionShortformSourceView(root, candidateId).final.reason).toContain("도입 문구 승인"); expect(captionShortformSourceView(root, candidateId).preview.inputFingerprint).not.toBeNull();
    disabled.approve(); const disabledInput = captionShortformSourceView(root, candidateId).final.inputFingerprint; expect(disabledInput).not.toBeNull(); expect(disabledInput).not.toBe(approvedInput);
    expect(() => hook("가".repeat(40))).not.toThrow(); expect(openingHookRenderState(root, candidateId).issue).toContain("2줄");
    expect(() => mutateOpeningHook(root, candidateId, { action: "approve", expectedRevision: readOpeningHook(root, candidateId)!.revision, expectedFingerprint: readOpeningHook(root, candidateId)!.fingerprint })).toThrow("2줄");
    hook("운영 시간 먼저 확인").approve(); hook(HOOK).approve();
    expect(counts()).toEqual(before); expect(readScenePlan(root)!.fingerprint).toBe(planFingerprint); expect(motionFresh()).toBe(true);
  }, 120_000);

  it("final v3 render: timeline, frame layout and audio agree; libass checks every cue plus the hook; no guide burned", async () => {
    health(); const view = captionShortformSourceView(root, candidateId);
    const job = queueCaptionShortform(root, candidateId, planFingerprint, view.final.inputFingerprint!, "final");
    expect(job.contract).toBe("narration-shortform-render-job-v3"); expect(job.renderConfig.previewGuideBurned).toBe(false); expect(job.renderConfig.fontSha256).toBe("26d0c6748500a0444844280b308f5b62c7ae92ac6c6ac88148e502dd211eb52a");
    const done = await runCaptionShortform(root, job.jobId);
    expect(done.status).toBe("completed"); expect(done.output!.layoutCheckedItems).toBe(job.captionPlan.cues.length + 1); expect(done.hook!.endMs).toBe(2000);
    const { videoPath, output } = requireCaptionShortformOutput(root, candidateId, job.jobId);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration,nb_frames", "-of", "json", videoPath], { encoding: "utf8" })) as { streams: { codec_type: string; duration: string; nb_frames: string }[] };
    const video = probe.streams.find(s => s.codec_type === "video")!; const sound = probe.streams.find(s => s.codec_type === "audio")!;
    const layout = motionFrameLayout(done.plan); expect(Number(video.nb_frames)).toBe(layout.at(-1)!.endFrame);
    const total = done.timeline.totalDurationMs; const frame = 1000 / 30;
    expect(Math.abs(Number(video.duration) * 1000 - total)).toBeLessThanOrEqual(frame);
    expect(Math.abs(Number(sound.duration) * 1000 - total)).toBeLessThanOrEqual(frame + 50); // AAC priming/padding
    expect(Math.abs(output.measuredDurationMs - total)).toBeLessThanOrEqual(frame + 50);
    const ass = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: output.assRelativePath }), "utf8");
    expect(ass.split("\n").filter(l => l.startsWith("Dialogue:")).every(l => /,(Caption|Hook),/.test(l))).toBe(true); expect(ass).not.toMatch(/\\p\d|guide/i);
    expect(existsSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: output.relativePath.replace("shortform.mp4", "layout-check") }))).toBe(false);
  }, 240_000);

  it("layout policy v1 → v2: old plans and render jobs are stale; regenerating keeps fitting reviewed cues, re-splits only overflowing ones and needs re-approval; no TTS/image/motion work", async () => {
    const counts = () => ({ tts: generate.mock.calls.length, audioJobs: fileCount(join(root, "context/narration/audio-jobs")), motionJobs: fileCount(join(root, "context/narration/motion/jobs")),
      plan: sha256FileSync(join(root, "context/narration/scenes/current.json")), motionIndex: sha256FileSync(join(root, "context/narration/motion/jobs-current.json")), images: fileCount(join(root, "media/narration-scenes", planFingerprint)) });
    const before = counts(); const approved = readCaptionPlan(root, candidateId)!; const target = narrationView.sentences[1]!.sentenceId;
    const segment = readNarrationAudioJob(root, audio.jobId).timeline!.segments.find(s => s.segmentId === target)!;
    const own = approved.cues.filter(c => c.sentenceId === target); const [first, last] = [own[0]!, own.at(-1)!];
    // A v1-era plan: reviewed, approved, and one sentence held as a single cue that only "fit" when glyphs rendered at ≈0.69× em.
    const merged = { ...first, sourceEnd: last.sourceEnd, text: [...segment.text].slice(first.sourceStart, last.sourceEnd).join("").trim(), endMs: last.endMs };
    const legacyCues = approved.cues.flatMap(c => c.sentenceId !== target ? [c] : c.cueId === first.cueId ? [merged] : []).map((c, i) => ({ ...c, ordinal: i + 1 }));
    const content = { ...approved, layoutPolicyId: "cross-platform-conservative-v1" as const, layoutPolicyFingerprint: "a".repeat(64), cues: legacyCues, revision: approved.revision + 1 };
    const fingerprint = captionFingerprint(content);
    writeFileSync(join(root, "context/narration/caption-plan/current.json"), JSON.stringify({ ...content, fingerprint, approval: { revision: content.revision, fingerprint, approvedAt: new Date().toISOString() } }));
    const stale = captionRenderState(root, candidateId); expect(stale.fresh).toBe(false); expect(stale.finalReady).toBe(false); expect(stale.previewReady).toBe(false); expect(stale.reason).toContain("배치 기준");
    expect(captionShortformSourceView(root, candidateId).final.inputFingerprint).toBeNull();

    // A v1-era render job is still readable but never fresh, and the worker refuses to render it under the v2 size rule.
    const done = readCaptionShortformJob(root, JSON.parse(readFileSync(join(root, "context/narration/shortform-jobs/caption-final-current.json"), "utf8")).jobId);
    const v1Config: Record<string, unknown> = { ...done.renderConfig, layoutPolicyId: "cross-platform-conservative-v1", layoutPolicyFingerprint: "b".repeat(64) };
    for (const key of ["fontSizeBasis", "captionAssFontSize", "hookAssFontSize"]) delete v1Config[key];
    const renderConfig = v1Config as typeof done.renderConfig;
    const legacyJob = { ...done, jobId: "00000000-0000-4000-8000-0000000000a1", renderConfig, rendererFingerprint: sceneHash(renderConfig), status: "queued" as const, startedAt: null, heartbeatAt: null, output: null };
    const legacyPath = join(root, "context/narration/shortform-jobs", `${legacyJob.jobId}.json`);
    writeFileSync(legacyPath, JSON.stringify({ ...legacyJob, inputFingerprint: captionShortformFingerprint(legacyJob) }));
    const legacyRead = readCaptionShortformJob(root, legacyJob.jobId); expect(legacyRead.renderConfig.layoutPolicyId).toBe("cross-platform-conservative-v1"); expect(captionShortformFresh(root, legacyRead)).toBe(false);
    const ran = await runCaptionShortform(root, legacyJob.jobId); expect(ran.status).toBe("stale"); expect(ran.output).toBeNull();
    expect(existsSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: `reel/narration-motion-render/${legacyRead.inputFingerprint}/${legacyJob.jobId}` }))).toBe(false);

    const regenerated = mutateCaptionPlan(root, candidateId, { action: "generate", expectedRevision: content.revision, expectedFingerprint: fingerprint });
    expect(regenerated.layoutPolicyId).toBe("cross-platform-conservative-v2"); expect(regenerated.approval).toBeNull();
    const pick = (c: (typeof approved.cues)[number]) => ({ cueId: c.cueId, sourceStart: c.sourceStart, sourceEnd: c.sourceEnd, startMs: c.startMs, endMs: c.endMs, timingSource: c.timingSource, reviewed: c.reviewed });
    for (const sentence of narrationView.sentences.filter(s => s.sentenceId !== target))
      expect(regenerated.cues.filter(c => c.sentenceId === sentence.sentenceId).map(pick)).toEqual(approved.cues.filter(c => c.sentenceId === sentence.sentenceId).map(pick));
    const resplit = regenerated.cues.filter(c => c.sentenceId === target); expect(resplit.length).toBeGreaterThanOrEqual(2);
    expect(resplit.every(c => !c.reviewed && c.timingSource === "estimated" && wrapTextLines(captionFontMetrics(), c.text, "caption") !== null)).toBe(true);
    const state = captionRenderState(root, candidateId); expect(state.fresh).toBe(true); expect(state.previewReady).toBe(true); expect(state.finalReady).toBe(false);
    expect(state.reason).toBe(`검토하지 않은 자막 cue ${resplit.length}개가 있습니다. 최종 영상 전 검토가 필요합니다.`);
    expect(captionShortformSourceView(root, candidateId).final.inputFingerprint).toBeNull();
    reviewAll(); expect(captionRenderState(root, candidateId).finalReady).toBe(true); expect(captionShortformSourceView(root, candidateId).final.inputFingerprint).not.toBeNull();
    expect(counts()).toEqual(before); expect(readScenePlan(root)!.fingerprint).toBe(planFingerprint); expect(motionFresh()).toBe(true);
  }, 120_000);

  it("verification 5: trimming keeps hook content approval but its display time is re-validated against the first scene", () => {
    const firstSceneEndMs = audio.timeline!.segments[1]!.startMs; const rawFirstSceneEndMs = audio.processing.segments[0]!.rawDurationMs! + 250;
    expect(firstSceneEndMs).toBeLessThan(3000); expect(rawFirstSceneEndMs).toBeGreaterThanOrEqual(3000); expect(currentFirstSceneEndMs(root, candidateId)).toBe(firstSceneEndMs);
    const approvedAt = readOpeningHook(root, candidateId)!.approval!.approvedAt; const fittingInput = captionShortformSourceView(root, candidateId).final.inputFingerprint;
    const long = hook(HOOK, true, { durationMs: 3000 }).saved;
    expect(openingHookApproved(long)).toBe(true); expect(long.approval!.approvedAt).toBe(approvedAt);
    expect(hookDisplayIssue(long, rawFirstSceneEndMs)).toBeNull(); // the untrimmed timeline had room
    const state = openingHookRenderState(root, candidateId, firstSceneEndMs); expect(state.displayIssue).toContain("수정 필요"); expect(state.finalReady).toBe(false);
    const view = captionShortformSourceView(root, candidateId); expect(view.final.inputFingerprint).toBeNull(); expect(view.final.reason).toContain("수정 필요"); expect(view.preview.inputFingerprint).not.toBeNull();
    const fixed = hook(HOOK, true, { durationMs: 2000 }).saved; expect(openingHookApproved(fixed)).toBe(true); expect(fixed.approval!.approvedAt).toBe(approvedAt);
    const refit = captionShortformSourceView(root, candidateId).final.inputFingerprint; expect(refit).not.toBeNull(); expect(refit).not.toBe(fittingInput);
  }, 120_000);

  it("v1 audio and v2 render jobs stay readable; v3 never overwrites them", async () => {
    health(); const v2 = queueMotionShortform(root, candidateId, planFingerprint, (await import("../motionService")).motionShortformSourceView(root, candidateId).inputFingerprint!);
    const v2Bytes = readFileSync(join(root, "context/narration/shortform-jobs", `${v2.jobId}.json`));
    const v3 = queueCaptionShortform(root, candidateId, planFingerprint, captionShortformSourceView(root, candidateId).preview.inputFingerprint!, "preview");
    expect(v3.jobId).not.toBe(v2.jobId); expect(readCompatibleShortform(root, v2.jobId).contract).toBe("narration-shortform-render-job-v2");
    expect(readCompatibleShortform(root, v3.jobId).contract).toBe("narration-shortform-render-job-v3");
    expect(readFileSync(join(root, "context/narration/shortform-jobs", `${v2.jobId}.json`)).equals(v2Bytes)).toBe(true);
    // A legacy raw-audio job: no processing hook, the original config fingerprint shape and 250ms cursor.
    const jobId = "00000000-0000-4000-8000-000000000001"; const config = audioConfigFingerprint(profile, "http://127.0.0.1:13900"); const runRelativeRoot = `reel/narration/v${narrationView.revision}/${config}/${jobId}`;
    const result = await generateNarrationMasterTimeline({ packageRoot: resolvePackageArtifactPath({ packageRoot: root, relativePath: runRelativeRoot }), candidateId, segments: narrationView.sentences.map(s => ({ segmentId: s.sentenceId, narrationText: s.text })),
      profile, provider: provider(profile.profileId), durationProbe: createFfprobeDurationProbe() });
    if (result.status !== "completed") throw new Error("legacy fixture failed");
    const legacy = { contract: "narration-audio-job-v1", jobId, narration: narrationView, profile, configFingerprint: config, endpointIdentity: "http://127.0.0.1:13900", createdAt: "2026-10-01T00:00:00.000Z", status: "completed", errorCode: null,
      timeline: { ...result.timeline, segments: result.timeline.segments.map(s => ({ ...s, relativeAudioPath: `${runRelativeRoot}/${s.relativeAudioPath}`, relativeGenerationPath: `${runRelativeRoot}/${s.relativeGenerationPath}` })) } };
    writeFileSync(join(root, "context/narration/audio-jobs", `${jobId}.json`), JSON.stringify(legacy));
    const read = readNarrationAudioJob(root, jobId); expect(read.contract).toBe("narration-audio-job-v1"); expect(processedAudioFingerprint(read)).toBeNull(); expect(audioReviewState(root, read).pending).toEqual([]);
    expect(read.timeline!.segments[0]!.durationMs).toBe(LEAD_MS + speechMs(SENTENCES[0]!) + TAIL_MS);
  }, 120_000);

  it("verification 7: a missing font or a hash mismatch fails clearly with no Regular/system fallback", async () => {
    const real = captionFontPath(); const regular = join(dirname(real), "NotoSansCJKkr-Regular.otf"); health();
    const preview = queueCaptionShortform(root, candidateId, planFingerprint, captionShortformSourceView(root, candidateId).preview.inputFingerprint!, "preview");
    try {
      vi.stubEnv("NARRATION_SHORTFORM_BOLD_FONT_FILE", join(root, "missing-font.otf"));
      expect(() => captionFontMetrics()).toThrow(/없습니다.*설치 절차/); expect(captionShortformSourceView(root, candidateId).preview.reason).toContain("글꼴");
      vi.stubEnv("NARRATION_SHORTFORM_BOLD_FONT_FILE", regular);
      expect(() => captionFontMetrics()).toThrow("SHA256"); expect(captionShortformSourceView(root, candidateId).final.reason).toContain("SHA256");
      const failed = await runCaptionShortform(root, preview.jobId);
      expect(failed).toMatchObject({ status: "failed", errorCode: "caption_font_invalid", output: null });
      expect(existsSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: `reel/narration-motion-render/${preview.inputFingerprint}/${preview.jobId}/shortform.mp4` }))).toBe(false);
    } finally { vi.stubEnv("NARRATION_SHORTFORM_BOLD_FONT_FILE", real); }
    expect(captionShortformSourceView(root, candidateId).preview.inputFingerprint).toBe(preview.inputFingerprint);
  }, 120_000);

  it("forced alignment: identical input dedupes, failure retries as a new attempt, verified sentences time cues without changing the split, approve-all needs a matching preview and acknowledgements; hook/layout edits never re-align", async () => {
    const counts = () => ({ tts: generate.mock.calls.length, audioJobs: fileCount(join(root, "context/narration/audio-jobs")), motionJobs: fileCount(join(root, "context/narration/motion/jobs")),
      plan: sha256FileSync(join(root, "context/narration/scenes/current.json")), motionIndex: sha256FileSync(join(root, "context/narration/motion/jobs-current.json")), images: fileCount(join(root, "media/narration-scenes", planFingerprint)) });
    const before = counts(); const alignmentJobs = join(root, "context/narration/caption-alignment/jobs"); health();
    const timeline = readNarrationAudioJob(root, audio.jobId).timeline!;
    const job = queueCaptionAlignment(root, candidateId, null);
    expect(job).toMatchObject({ status: "queued", attempt: 1, audioJobId: audio.jobId }); expect(JSON.parse(readFileSync(join(queue, `${job.jobId}.json`), "utf8"))).toMatchObject({ kind: "caption-align-v1", jobId: job.jobId });
    expect(job.sentences.map(s => [s.sentenceId, s.audioSha256, s.text])).toEqual(timeline.segments.map(s => [s.segmentId, s.audioSha256, s.text])); // processed WAVs, approved text, no re-split
    expect(queueCaptionAlignment(root, candidateId, job.inputFingerprint).jobId).toBe(job.jobId); expect(() => queueCaptionAlignment(root, candidateId, "0".repeat(64))).toThrow("바뀌었습니다");
    let attempts = 0; const failed = await runCaptionAlignment(root, job.jobId, async () => { attempts++; throw new Error("remote_timeout"); });
    expect(failed).toMatchObject({ status: "failed", errorCode: "remote_timeout", result: null }); expect(attempts).toBe(2); expect(usableAlignment(root, candidateId)).toBeNull();
    const retry = queueCaptionAlignment(root, candidateId, job.inputFingerprint); expect(retry.jobId).not.toBe(job.jobId); expect(retry.attempt).toBe(2);
    const review = narrationView.sentences[2]!.sentenceId; const aligner = fakeAligner(new Set([review]));
    const done = await runCaptionAlignment(root, retry.jobId, aligner.execute);
    expect(done.status).toBe("completed"); expect(done.result!.sentences.map(s => s.status)).toEqual(["verified", "verified", "review_required"]);
    expect(queueCaptionAlignment(root, candidateId, retry.inputFingerprint).jobId).toBe(retry.jobId); await runCaptionAlignment(root, retry.jobId, aligner.execute); expect(aligner.calls).toHaveLength(1);

    const plan = readCaptionPlan(root, candidateId)!;
    const applied = mutateCaptionPlan(root, candidateId, { action: "apply-alignment", expectedRevision: plan.revision, expectedFingerprint: plan.fingerprint });
    const split = (cues: typeof plan.cues) => cues.map(c => [c.cueId, c.sentenceId, c.sourceStart, c.sourceEnd, c.text]);
    expect(split(applied.cues)).toEqual(split(plan.cues)); expect(applied.approval).toBeNull();
    expect(applied.alignment).toEqual({ jobId: retry.jobId, audioTextFingerprint: done.audioTextFingerprint, resultFingerprint: done.result!.resultFingerprint });
    for (const cue of applied.cues) expect(cue.timingSource).toBe(cue.sentenceId === review ? "estimated" : "forced_alignment");
    const long = timeline.segments[1]!; const longCues = applied.cues.filter(c => c.sentenceId === long.segmentId); const units = done.result!.sentences[1]!.units;
    expect(longCues[0]!.startMs).toBe(long.startMs); expect(longCues.at(-1)!.endMs).toBe(long.endMs);
    for (const cue of longCues.slice(1)) expect(cue.startMs).toBe(long.startMs + units.find(u => u.cpStart >= cue.sourceStart)!.startMs!);
    const state = captionRenderState(root, candidateId); expect(state.issues.filter(i => i.severity === "error")).toEqual([]);
    expect(state.issues.filter(i => i.code === "alignment_review").map(i => i.cueId)).toEqual(applied.cues.filter(c => c.sentenceId === review).map(c => c.cueId));
    const attention = captionAttention(applied, state.issues); for (const cue of applied.cues.filter(c => c.sentenceId === review)) expect(attention.has(cue.cueId)).toBe(true);

    // A forced_alignment cue whose times no longer match the alignment is an error, not a silent pass.
    const planFile = join(root, "context/narration/caption-plan/current.json"); const original = readFileSync(planFile);
    const tampered = { ...applied, cues: applied.cues.map(c => c.cueId === longCues[1]!.cueId ? { ...c, startMs: c.startMs + 40 } : c.cueId === longCues[0]!.cueId ? { ...c, endMs: c.endMs + 40 } : c) };
    writeFileSync(planFile, JSON.stringify({ ...tampered, fingerprint: captionFingerprint(tampered) }));
    expect(captionRenderState(root, candidateId).issues.filter(i => i.code === "alignment_stale").map(i => i.cueId).sort()).toEqual([longCues[0]!.cueId, longCues[1]!.cueId].sort());
    writeFileSync(planFile, original);

    health(); const preview = queueCaptionShortform(root, candidateId, planFingerprint, captionShortformSourceView(root, candidateId).preview.inputFingerprint!, "preview");
    const bulk = (acknowledgedCueIds: string[]) => { const current = readCaptionPlan(root, candidateId)!;
      return bulkApproveCaptionPlan(root, candidateId, { action: "approve-all", expectedRevision: current.revision, expectedFingerprint: current.fingerprint, previewJobId: preview.jobId, acknowledgedCueIds }, p => requireCaptionPreviewFor(root, candidateId, preview.jobId, p.fingerprint)); };
    expect(() => bulk([...attention.keys()])).toThrow("완료 영상");
    expect((await runCaptionShortform(root, preview.jobId)).status).toBe("completed");
    expect(() => bulk([...attention.keys()].slice(1))).toThrow("확인 표시");
    const approved = bulk([...attention.keys()]);
    expect(approved.approval).not.toBeNull(); expect(approved.cues.every(c => c.reviewed)).toBe(true);
    expect(approved.cues.map(c => [c.startMs, c.endMs, c.timingSource])).toEqual(applied.cues.map(c => [c.startMs, c.endMs, c.timingSource])); expect(captionRenderState(root, candidateId).finalReady).toBe(true);

    // Hook text and layout-only changes reuse the alignment: no new alignment job, TTS, audio or motion work.
    const files = fileCount(alignmentJobs); hook("운영 시간 먼저 확인").approve(); hook(HOOK).approve();
    expect(alignmentInputFingerprint(alignmentInputs(root, candidateId))).toBe(retry.inputFingerprint); expect(queueCaptionAlignment(root, candidateId, null).jobId).toBe(retry.jobId);
    const content = { ...approved, layoutPolicyId: "cross-platform-conservative-v1" as const, layoutPolicyFingerprint: "a".repeat(64), revision: approved.revision + 1 }; const fingerprint = captionFingerprint(content);
    writeFileSync(planFile, JSON.stringify({ ...content, fingerprint, approval: { revision: content.revision, fingerprint, approvedAt: new Date().toISOString() } }));
    const regenerated = mutateCaptionPlan(root, candidateId, { action: "generate", expectedRevision: content.revision, expectedFingerprint: fingerprint });
    expect(regenerated.cues.map(c => [c.cueId, c.startMs, c.endMs, c.timingSource, c.reviewed])).toEqual(approved.cues.map(c => [c.cueId, c.startMs, c.endMs, c.timingSource, c.reviewed]));
    expect(regenerated.alignment).toEqual(applied.alignment); expect(captionRenderState(root, candidateId).issues.filter(i => i.severity === "error")).toEqual([]);
    reviewAll(); expect(captionRenderState(root, candidateId).finalReady).toBe(true);
    expect(fileCount(alignmentJobs)).toBe(files); expect(aligner.calls).toHaveLength(1); expect(counts()).toEqual(before); expect(motionFresh()).toBe(true);
  }, 240_000);

  it("verification 3: changing only the global default policy keeps existing jobs, approvals and renders fresh", () => {
    health(); const final = queueCaptionShortform(root, candidateId, planFingerprint, captionShortformSourceView(root, candidateId).final.inputFingerprint!, "final");
    const before = captionShortformSourceView(root, candidateId).final.inputFingerprint; expect(processingPolicyOutdated(audio)).toBe(false);
    policy.override = { ...EDGE_TRIM_POLICY, policyId: "edge-energy-trim-v2", guards: { leadingMs: 40, trailingMs: 60 } };
    const job = readNarrationAudioJob(root, audio.jobId); expect(job.contract === "narration-audio-job-v2" && job.processing.policy).toEqual(EDGE_TRIM_POLICY);
    expect(processingPolicyOutdated(job)).toBe(true); expect(scenePlanFresh(root, candidateId, readScenePlan(root)!)).toBe(true); expect(captionRenderState(root, candidateId).fresh).toBe(true);
    expect(motionFresh()).toBe(true); expect(audioReviewState(root, job).pending).toEqual([]);
    expect(captionShortformSourceView(root, candidateId).final.inputFingerprint).toBe(before); expect(captionShortformFresh(root, readCaptionShortformJob(root, final.jobId))).toBe(true);
  }, 120_000);

  it("verification 4: explicit reprocessing with the new policy is a new job that stales plan, captions, motion and render; approvals do not carry over", async () => {
    try {
      const legacyId = "00000000-0000-4000-8000-000000000001"; const legacyBytes = readFileSync(join(root, "context/narration/audio-jobs", `${legacyId}.json`));
      const calls = generate.mock.calls.length; const planBefore = readFileSync(join(root, "context/narration/scenes/current.json"));
      const final = readCaptionShortformJob(root, JSON.parse(readFileSync(join(root, "context/narration/shortform-jobs/caption-final-current.json"), "utf8")).jobId);
      const finished = readdirSync(join(root, "context/narration/shortform-jobs")).filter(n => /^[a-f0-9-]{36}\.json$/.test(n) && JSON.parse(readFileSync(join(root, "context/narration/shortform-jobs", n), "utf8")).contract === "narration-shortform-render-job-v3")
        .map(n => readCaptionShortformJob(root, n.replace(".json", ""))).find(j => j.status === "completed" && j.output)!;
      const next = await reprocessNarrationAudio({ root, candidateId, sourceJobId: audio.jobId, lineage: lineage(), durationProbe: createFfprobeDurationProbe() });
      expect(next.status).toBe("completed"); expect(next.jobId).not.toBe(audio.jobId); expect(generate.mock.calls.length).toBe(calls);
      if (next.contract !== "narration-audio-job-v2") throw new Error("v2 expected");
      expect(next.processing.policy).toEqual(policy.override); expect(next.processing.policyId).toBe("edge-energy-trim-v2"); expect(processingPolicyOutdated(next)).toBe(false);
      expect(next.processing.sourceAudioJobId).toBe(audio.jobId); expect(next.processing.segments.map(s => s.rawSha256)).toEqual(audio.processing.segments.map(s => s.rawSha256));
      expect(scenePlanFresh(root, candidateId, readScenePlan(root)!)).toBe(false); expect(captionRenderState(root, candidateId).fresh).toBe(false); expect(motionFresh()).toBe(false);
      expect(captionShortformFresh(root, final)).toBe(false);
      // New audio bytes: the alignment no longer applies; a new alignment job is needed for the new WAVs.
      expect(usableAlignment(root, candidateId)).toBeNull(); expect(alignmentView(root, candidateId).job!.fresh).toBe(false);
      health(); const realign = queueCaptionAlignment(root, candidateId, null); expect(realign).toMatchObject({ status: "queued", audioJobId: next.jobId, attempt: 1 });
      const review = next.processing.segments.find(s => s.status === "review_required")!;
      expect(review.rawSha256).toBe(reviewSegment().rawSha256); expect(audioReviewState(root, next).pending).toEqual([review.segmentId]);
      // Hook content approval survives re-timing; only its display check follows the new first scene.
      expect(openingHookApproved(readOpeningHook(root, candidateId)!)).toBe(true); expect(openingHookRenderState(root, candidateId).fresh).toBe(true);
      expect(currentFirstSceneEndMs(root, candidateId)).toBe(next.timeline!.segments[1]!.startMs); expect(next.timeline!.segments[1]!.startMs).toBeLessThan(audio.timeline!.segments[1]!.startMs);
      // Nothing is deleted or relinked: old jobs, finished video, raw WAVs and the old plan stay as they were.
      expect(readFileSync(join(root, "context/narration/audio-jobs", `${legacyId}.json`)).equals(legacyBytes)).toBe(true);
      expect(readFileSync(join(root, "context/narration/scenes/current.json")).equals(planBefore)).toBe(true);
      expect(sha256FileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: finished.output!.relativePath }))).toBe(finished.output!.sha256);
      for (const segment of audio.processing.segments) expect(sha256FileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.rawRelativePath }))).toBe(segment.rawSha256);
      expect(() => mutateScenePlan(root, candidateId, { action: "approve", audioJobId: next.jobId, expectedNarrationRevision: narrationView.revision, expectedNarrationFingerprint: narrationView.fingerprint,
        expectedRevision: readScenePlan(root)!.revision, expectedFingerprint: readScenePlan(root)!.fingerprint })).toThrow();
      await expect(reprocessNarrationAudio({ root, candidateId, sourceJobId: next.jobId, lineage: lineage(), durationProbe: createFfprobeDurationProbe() })).rejects.toThrow("이미 현재");
    } finally { policy.override = null; }
  }, 120_000);

  it("manual edge range: raw-sample bounds, raw and earlier outputs untouched, duration re-measured, no TTS; warnings need acknowledgement; downstream goes stale; a changed raw voids it", async () => {
    const source = latestNarrationAudioJob(root, candidateId)!; if (source.contract !== "narration-audio-job-v2") throw new Error("v2 expected");
    const segment = source.processing.segments.find(s => s.status === "review_required")!; const rawPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.rawRelativePath }); const raw = readFileSync(rawPath);
    const view = edgeReviewView(root, source, segment.segmentId); const speech = speechMs(SENTENCES[2]!); const at = (ms: number) => ms * SR / 1000;
    expect(view.rawSampleCount).toBe(at(LONG_LEAD_MS + speech + TAIL_MS)); expect(view.detected).toEqual({ startSample: at(LONG_LEAD_MS), endSampleExclusive: at(LONG_LEAD_MS + speech) });
    expect(view.suggestion!.warnings).toContain("leading_trim_exceeds_1500ms"); expect(view.editable).toBe(true); expect(view.peaks.length).toBeGreaterThan(100);
    const calls = generate.mock.calls.length; const sourceFile = join(root, "context/narration/audio-jobs", `${source.jobId}.json`); const sourceBytes = readFileSync(sourceFile);
    const processedBefore = source.timeline!.segments.map(s => sha256FileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: s.relativeAudioPath })));
    const start = at(LONG_LEAD_MS - 100); const end = at(LONG_LEAD_MS + speech + 100);
    const decision = (overrides: Record<string, unknown> = {}) => ({ sentenceId: segment.segmentId, mode: "manual_range" as const, startSample: start, endSampleExclusive: end, expectedRawSha256: segment.rawSha256, acknowledgedWarnings: [] as string[], ...overrides });
    const apply = (decisions: ReturnType<typeof decision>[], sourceJobId = source.jobId) => applyEdgeRanges({ root, candidateId, mutation: { action: "apply-edge-ranges", sourceJobId, decisions }, lineage: lineage(), durationProbe: createFfprobeDurationProbe() });
    await expect(apply([decision({ endSampleExclusive: view.rawSampleCount + 1 })])).rejects.toThrow("샘플"); await expect(apply([decision({ startSample: end })])).rejects.toThrow("샘플");
    await expect(apply([decision({ expectedRawSha256: "0".repeat(64) })])).rejects.toThrow("원본 음성이 바뀌었습니다");
    await expect(apply([decision()])).rejects.toThrow("확인이 필요한 경고"); await expect(apply([decision({ mode: "auto_range", acknowledgedWarnings: view.suggestion!.warnings })])).rejects.toThrow("자동 제안");
    const ready = source.processing.segments.find(s => s.status === "ready")!;
    await expect(apply([decision({ sentenceId: ready.segmentId, expectedRawSha256: ready.rawSha256 })])).rejects.toThrow("검토 필요");
    expect(latestNarrationAudioJob(root, candidateId)!.jobId).toBe(source.jobId); // refused requests create nothing

    const warnings = ["leading_trim_exceeds_1500ms", "total_trim_at_least_40_percent"];
    const applied = await apply([decision({ acknowledgedWarnings: warnings })]); if (applied.contract !== "narration-audio-job-v2") throw new Error("v2 expected");
    expect(applied.status).toBe("completed"); expect(applied.jobId).not.toBe(source.jobId); expect(generate.mock.calls.length).toBe(calls);
    expect(applied.processing).toMatchObject({ sourceAudioJobId: source.jobId, policyFingerprint: source.processing.policyFingerprint });
    const changed = applied.processing.segments.find(s => s.segmentId === segment.segmentId)!;
    expect(changed).toMatchObject({ status: "ready", rawSha256: segment.rawSha256, diagnostics: [], edgeDecision: { mode: "manual_range", startSample: start, endSampleExclusive: end, warnings, acknowledgedWarnings: warnings } });
    const timelineSegment = applied.timeline!.segments.find(s => s.segmentId === segment.segmentId)!; const cut = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: timelineSegment.relativeAudioPath }));
    expect(cut.equals(sliceWav(raw, parsePcmWav(raw), start, end))).toBe(true); expect(timelineSegment.durationMs).toBe((end - start) * 1000 / SR); expect(changed.measuredDurationMs).toBe(timelineSegment.durationMs);
    expect(applied.processing.segments.filter(s => s.segmentId !== segment.segmentId).map(s => s.processedSha256)).toEqual(source.processing.segments.filter(s => s.segmentId !== segment.segmentId).map(s => s.processedSha256));
    expect(audioReviewState(root, applied).pending).toEqual([]);
    expect(readFileSync(rawPath).equals(raw)).toBe(true); expect(readFileSync(sourceFile).equals(sourceBytes)).toBe(true);
    expect(source.timeline!.segments.map(s => sha256FileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: s.relativeAudioPath })))).toEqual(processedBefore);
    // New audio: captions, alignment, motion and the scene plan follow the new job; a new alignment job is needed for the changed WAV.
    expect(captionRenderState(root, candidateId).fresh).toBe(false); expect(usableAlignment(root, candidateId)).toBeNull(); expect(motionFresh()).toBe(false);
    expect(alignmentInputs(root, candidateId).sentences.find(s => s.sentenceId === segment.segmentId)!.audioSha256).toBe(changed.processedSha256);
    // A decided sentence can switch to the automatic suggestion; the earlier range is not reused for it.
    const auto = await apply([decision({ mode: "auto_range", startSample: view.suggestion!.startSample, endSampleExclusive: view.suggestion!.endSampleExclusive, acknowledgedWarnings: view.suggestion!.warnings })], applied.jobId);
    if (auto.contract !== "narration-audio-job-v2") throw new Error("v2 expected");
    expect(auto.processing.segments.find(s => s.segmentId === segment.segmentId)!.edgeDecision).toMatchObject({ mode: "auto_range", startSample: view.suggestion!.startSample }); expect(generate.mock.calls.length).toBe(calls);
    // Raw bytes changed after the decision: the job no longer verifies and no range or approval is reused.
    try {
      const tampered = Buffer.from(raw); tampered.writeInt16LE(1234, 44 + 2 * at(LONG_LEAD_MS + 50)); writeFileSync(rawPath, tampered);
      expect(() => readNarrationAudioJob(root, auto.jobId)).toThrow("원본 음성"); await expect(apply([decision({ acknowledgedWarnings: warnings })], auto.jobId)).rejects.toThrow();
    } finally { writeFileSync(rawPath, raw); }
    expect(readNarrationAudioJob(root, auto.jobId).status).toBe("completed");
  }, 120_000);
});
