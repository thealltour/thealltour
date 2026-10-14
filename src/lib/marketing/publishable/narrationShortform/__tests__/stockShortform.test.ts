// @vitest-environment node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import { narrationLineage, mutateNarration } from "../../narration/persistence";
import { queueNarrationAudio, runNarrationAudioJob, type ProcessedNarrationAudioJob } from "../../narration/audio";
import { mutateOpeningHook, readOpeningHook } from "../../narration/openingHook";
import { buildSceneHandoff, mutateScenePlan, readScenePlan, sceneHash } from "../../narrationScenes/service";
import { uploadSceneAsset } from "../../narrationScenes/assets";
import { approveMotionJobs, motionView, queueMotionJobs, readMotionJob, saveMotionSettings, writeMotionJob } from "../../narrationMotion/service";
import { motionFrameLayout } from "../../narrationMotion/frameLayout";
import { mutateCaptionPlan, readCaptionPlan } from "../captionPlan";
import { captionShortformFresh, captionShortformSourceView, queueCaptionShortform, readCaptionShortformJob, requireCaptionShortformOutput, runCaptionShortform } from "../motionService";
import type { PlaceReviewInput, StockClipJob, StockProvider, StockSceneSearchPlanV2 } from "../../narrationVisualSources/contracts";
import { approveStockClip, currentStockClipJob, makeStockClip, readStockClipJob, requireStockClipOutput, selectImageMotion, selectStockSource, stockClipJobFresh, updateStockPlaceReview, writeStockClipJob } from "../../narrationVisualSources/clips";
import { runStockClipJob } from "../../narrationVisualSources/clipWorker";
import { emptySceneV2 } from "../../narrationVisualSources/requirements";
import { reviewCandidate, setSceneNoSuitable } from "../../narrationVisualSources/reviews";
import { saveSearchPlan } from "../../narrationVisualSources/searchPlan";
import { readQueryHistory } from "../../narrationVisualSources/queryHistory";
import { fetchNextPage, revealMoreCandidates, runSceneSearch } from "../../narrationVisualSources/search";
import { runSupplement } from "../../narrationVisualSources/supplement";
import { readAttemptLog, readLocators, readSceneSearch, readSearchPlan, readSelection, writeLocator } from "../../narrationVisualSources/store";
import { visualSourcesView } from "../../narrationVisualSources/view";
import { corruptVideo, fixtureFetch, frameLumas, probeStreams, rampVideo } from "../../narrationVisualSources/__tests__/stockFixtures";

const hook = vi.hoisted(() => ({ armed: null as null | { match: (args: readonly string[]) => boolean; run: () => void | Promise<void> } }));
vi.mock("@/lib/marketing/assets/ffmpeg/exec", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/marketing/assets/ffmpeg/exec")>();
  return { ...actual, runFfmpeg: async (input: Parameters<typeof actual.runFfmpeg>[0]) => {
    const armed = hook.armed; if (armed?.match(input.args)) { hook.armed = null; await armed.run(); }
    return actual.runFfmpeg(input);
  } };
});
const isNormalize = (args: readonly string[]) => args.includes("-ss") && args.some(a => a.endsWith("/scene.mp4"));
const isDecodeCheck = (args: readonly string[]) => args.includes("null") && args.some(a => a.endsWith("/scene.mp4"));
const isRender = (args: readonly string[]) => args.some(a => a.endsWith("/shortform.mp4"));

const SR = 16000;
const speechMs = (text: string) => Math.max(600, Math.round([...text].length * 9) * 10);
function toneWav(text: string) {
  const lead = 600; const tail = 700; const speech = speechMs(text); const total = (lead + speech + tail) * SR / 1000;
  const audio = Buffer.alloc(44 + total * 2); audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(SR, 24); audio.writeUInt32LE(SR * 2, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i++) { const ms = i * 1000 / SR - lead; audio.writeInt16LE(ms >= 0 && ms < speech ? Math.round(Math.sin(2 * Math.PI * 220 * i / SR) * 0.3 * 32767) : 0, 44 + i * 2); }
  return audio;
}
const SENTENCES = ["횡단보도에서는 신호가 바뀔 때까지 기다리세요.", "버스 정류장은 출퇴근 시간에 특히 붐빕니다.", "밤에는 차량 불빛 때문에 시야가 좁아집니다."];
const candidateId = "stock-test";
const URL_1001 = "https://videos.pexels.com/video-files/1001/cfr-1080x1920.mp4";
const URL_2001 = "https://cdn.pixabay.com/video/2026/2001-medium.mp4";
const GENERIC: PlaceReviewInput = { placeRequirement: "generic_allowed", misattributionReviewed: true };
const SPECIFIC: PlaceReviewInput = { placeRequirement: "specific_place", placeName: "Myeongdong", sourceChecked: true, evidenceUrl: "https://www.pexels.com/video/people-crossing-a-busy-street-1001/", note: "출처 페이지 설명과 간판을 직접 확인" };

let root: string; let queue: string; let fixtures: string; let canonical: CanonicalMarketingAsset; let narrationView: ReturnType<typeof mutateNarration>; let audio: ProcessedNarrationAudioJob;
let net: ReturnType<typeof fixtureFetch>; let cfrPath: string;
const lineage = () => narrationLineage(canonical, root);
const provider = (profileId: string): TtsProvider => ({ providerId: "voicestudio", generate: async input => {
  const bytes = toneWav(input.text);
  return { contract: "tts-generation-result-v1" as const, requestId: input.requestId, provider: "voicestudio" as const, profileId, mediaType: "audio/wav" as const, format: "wav" as const, sampleRate: SR, channels: 1,
    byteSize: bytes.length, sha256: sha256Buffer(bytes), providerGenerationId: null, providerReportedDurationMs: null, containerDurationMs: null, timelineAuthoritative: false as const,
    generatedAt: new Date().toISOString(), segmentId: input.segmentId ?? null, metadata: { modelRef: "m", voiceRef: "v", httpStatus: 200 }, audio: bytes };
} });
const health = () => writeFileSync(join(queue, "health.json"), JSON.stringify({ heartbeatAt: new Date().toISOString(), pid: 1 }));
const plan = () => readScenePlan(root)!;
const v0 = () => plan().scenes[0]!.visualId;
const selectionFingerprint = () => readSelection(root)?.fingerprint ?? null;
const providerCalls = () => net.log.filter(l => l.kind === "provider_api").length;
const downloads = () => net.log.filter(l => l.kind === "download").length;
const final = () => captionShortformSourceView(root, candidateId).final;
const lockDirectory = () => join(root, "context/narration/scenes/.mutation-lock");
const motionJobFor = (visualId: string) => readMotionJob(root, JSON.parse(readFileSync(join(root, "context/narration/motion/jobs-current.json"), "utf8"))[visualId]);

function searchScenes(place: string | null): StockSceneSearchPlanV2[] {
  return plan().scenes.map((scene, i) => i === 0
    ? { visualId: scene.visualId, searchEnabled: true, coreSubject: "pedestrians at a crosswalk", coreAction: "people crossing the street",
      place: place ? { scope: "specific_place" as const, name: place, region: null } : { scope: "any" as const, name: null, region: null },
      required: [], preferred: ["city street"], exclude: [], relaxable: [], misattributionRisk: place ? "" : "generic crosswalk; not tied to a venue", humanChecks: [],
      queries: [place ? { text: `${place} street`, strategy: "place_subject" as const, purpose: "장소명이 붙은 거리 영상" } : { text: "busy crosswalk", strategy: "subject_action" as const, purpose: "횡단보도를 건너는 사람들" }] }
    : emptySceneV2(scene.visualId));
}
function savePlan(place: string | null) { return saveSearchPlan(root, candidateId, plan().fingerprint, readSearchPlan(root, plan())?.fingerprint ?? null, searchScenes(place)); }
const target = () => ({ expectedPlanFingerprint: plan().fingerprint, expectedSearchPlanFingerprint: readSearchPlan(root, plan())!.fingerprint, visualId: v0() });
const search = (newSession = false) => runSceneSearch(root, candidateId, { ...target(), newSession });
function select(provider: StockProvider, videoId: string, startMs: number, placeReview: PlaceReviewInput) {
  health(); return selectStockSource(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, expectedSelectionFingerprint: selectionFingerprint(), visualId: v0(), provider, videoId, startMs, placeReview });
}
const chooseImage = () => selectImageMotion(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, expectedSelectionFingerprint: selectionFingerprint(), visualId: v0() });
const current = () => currentStockClipJob(root, v0())!;
const approve = (job: StockClipJob) => approveStockClip(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, expectedSelectionFingerprint: selectionFingerprint()!, visualId: v0(),
  jobId: job.jobId, expectedOriginalSha256: job.original!.sha256, expectedOutputSha256: job.output!.sha256 });
const clipPath = (job: StockClipJob) => resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output!.relativePath });
const frames0 = () => { const layout = motionFrameLayout(plan())[0]!; return layout.endFrame - layout.startFrame; };

async function buildScenesAndMotion() {
  const input = { audioJobId: audio.jobId, expectedNarrationRevision: narrationView.revision, expectedNarrationFingerprint: narrationView.fingerprint };
  const saved = mutateScenePlan(root, candidateId, { action: "save", ...input, expectedRevision: null, expectedFingerprint: null, prompts: narrationView.sentences.map(s => ({ sentenceId: s.sentenceId, visualPrompt: "도심 횡단보도" })) }).plan;
  const approved = mutateScenePlan(root, candidateId, { action: "approve", ...input, expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint }).plan;
  mutateScenePlan(root, candidateId, { action: "handoff", ...input, expectedRevision: approved.revision, expectedFingerprint: approved.fingerprint });
  const handoff = buildSceneHandoff(approved);
  for (const [i, scene] of approved.scenes.entries()) {
    const bytes = await sharp({ create: { width: 90, height: 160, channels: 3, background: { r: 40 + i * 60, g: 90, b: 120 } } }).png().toBuffer();
    await uploadSceneAsset({ root, candidateId, visualId: scene.visualId, bytes, planFingerprint: approved.fingerprint, handoffFingerprint: handoff.fingerprint });
  }
  const settings = saveMotionSettings(root, candidateId, approved.fingerprint, null, approved.scenes.map(s => ({ visualId: s.visualId, choice: { preset: "static" as const, strength: "low" as const } })));
  health(); const jobs = queueMotionJobs(root, candidateId, approved.fingerprint, settings.fingerprint, approved.scenes.map(s => s.visualId));
  for (const [i, job] of jobs.entries()) {
    // Stand-in for the mini-PC motion worker output only; the job contract and approval path are the real ones.
    const frames = job.source.endFrame - job.source.startFrame; const prefix = `media/narration-motion/${job.inputFingerprint}/${job.jobId}`;
    const video = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/scene.mp4` }); mkdirSync(dirname(video), { recursive: true });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${(0x305070 + i * 0x202000).toString(16)}:s=720x1280:r=30`, "-frames:v", String(frames), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", video]);
    const manifest = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${prefix}/execution.json` }); writeFileSync(manifest, "{}");
    writeMotionJob(root, { ...job, status: "completed", startedAt: job.createdAt, heartbeatAt: job.createdAt, completedAt: new Date().toISOString(), output: { relativePath: `${prefix}/scene.mp4`, sha256: sha256FileSync(video),
      byteSize: statSync(video).size, width: 720, height: 1280, fps: 30, frameCount: frames, durationMs: Math.round(frames * 1000 / 30), manifestRelativePath: `${prefix}/execution.json`, manifestSha256: sha256FileSync(manifest) } });
  }
  approveMotionJobs(root, candidateId, approved.fingerprint, settings.fingerprint, jobs.map(j => ({ jobId: j.jobId, expectedOutputSha256: readMotionJob(root, j.jobId).output!.sha256 })));
}
function approveCaptionsAndHook() {
  const generated = mutateCaptionPlan(root, candidateId, { action: "generate", expectedRevision: null, expectedFingerprint: null });
  const saved = mutateCaptionPlan(root, candidateId, { action: "save", expectedRevision: generated.revision, expectedFingerprint: generated.fingerprint, cues: generated.cues.map(c => ({ sentenceId: c.sentenceId, text: c.text, startMs: c.startMs, endMs: c.endMs, reviewed: true })) });
  mutateCaptionPlan(root, candidateId, { action: "approve", expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint });
  const draft = mutateOpeningHook(root, candidateId, { action: "save", expectedRevision: null, expectedFingerprint: null, text: "길을 건너기 전 확인할 것", enabled: true, sourceSentenceIds: [narrationView.sentences[0]!.sentenceId], durationMs: 2000 });
  mutateOpeningHook(root, candidateId, { action: "approve", expectedRevision: draft.revision, expectedFingerprint: draft.fingerprint });
}
/** Holds the real scene lock from a separate Node process, as the Next server or the worker would. */
async function holdLockInOtherProcess(holdMs: number) {
  const script = join(fixtures, "hold-lock.mts"); const flag = join(fixtures, `lock-${Date.now()}`);
  writeFileSync(script, `import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
// Same server-only shim as scripts/marketing-narration-motion-worker.ts.
const require = createRequire(import.meta.url); const Module = require("module");
const original = Module._resolveFilename.bind(Module); const stub = ${JSON.stringify(join(process.cwd(), "scripts/shims/server-only.js"))};
Module._resolveFilename = (request, ...rest) => request === "server-only" ? stub : original(request, ...rest);
const { withSceneLock } = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), "src/lib/marketing/publishable/narrationScenes/service.ts")).href)});
withSceneLock(process.argv[2], () => { writeFileSync(process.argv[3], "held"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.argv[4])); writeFileSync(process.argv[3] + ".released", String(Date.now())); });
`);
  const child = spawn(process.execPath, ["--import", "tsx", script, root, flag, String(holdMs)], { cwd: process.cwd(), stdio: "ignore" });
  const exited = new Promise<number | null>(resolve => child.on("exit", resolve));
  for (let i = 0; i < 600 && !existsSync(flag); i++) await new Promise(resolve => setTimeout(resolve, 100));
  if (!existsSync(flag)) { child.kill(); throw new Error("lock holder did not start"); }
  return { exited, releasedAt: () => Number(readFileSync(`${flag}.released`, "utf8")) };
}

const hasFfmpeg = ["ffmpeg", "ffprobe"].every(tool => spawnSync(tool, ["-version"], { stdio: "ignore" }).status === 0);
describe.skipIf(!hasFfmpeg)("stock video scenes: selection snapshot, normalization, async staleness and mixed render (local fixtures, no network)", () => {
  let v3Fingerprint: string;
  let refA: number[];
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "stock-shortform-")); queue = join(root, ".queue"); mkdirSync(queue, { recursive: true });
    fixtures = mkdtempSync(join(tmpdir(), "stock-fixtures-"));
    vi.stubEnv("VOICESTUDIO_BASE_URL", "http://127.0.0.1:13900"); vi.stubEnv("NARRATION_TTS_PROFILE_JSON", ""); vi.stubEnv("NARRATION_MOTION_QUEUE_DIR", queue);
    vi.stubEnv("PEXELS_API_KEY", "fixture-pexels-key"); vi.stubEnv("PIXABAY_API_KEY", "fixture-pixabay-key");
    vi.stubEnv("NARRATION_STOCK_STATE_DIR", join(root, ".stock-state")); vi.stubEnv("NARRATION_STOCK_SEARCH_CACHE_DIR", join(root, ".stock-cache"));
    cfrPath = rampVideo(join(fixtures, "cfr.mp4"), { seconds: 6, audio: true });
    const vfr = rampVideo(join(fixtures, "vfr.mp4"), { seconds: 6, vfr: true });
    net = fixtureFetch({ files: { [URL_1001]: cfrPath, [`${URL_1001}?refreshed=1`]: cfrPath, [URL_2001]: vfr,
      "https://videos.pexels.com/video-files/1004/b-1080x1920.mp4": corruptVideo(join(fixtures, "corrupt.mp4")),
      "https://videos.pexels.com/video-files/1005/c-1080x1920.mp4": rampVideo(join(fixtures, "short.mp4"), { seconds: 1 }) } });
    vi.stubGlobal("fetch", net.impl);
    refA = frameLumas(cfrPath);
    canonical = { contract: "canonical-marketing-asset-v1", assetId: "cma-stock", version: 1, status: "approved", agendaId: "agenda", storyPointId: "story", storyPointHash: "story-hash", evidenceBriefRef: null,
      evidenceRevision: "evidence-v1", contentPropositionRef: null, propositionRevision: "proposition-v1", sourceRevision: "source-v1", titleKo: "도심 보행 안전", dekKo: null, openingHookKo: "길을 건너기 전에 확인합니다.",
      bodyKo: "보행 조건을 확인합니다.", keyTakeawaysKo: [], decisionGuidanceKo: "공식 안내를 확인합니다.", optionalCtaIntentKo: null, evidenceRefs: [], limitationsKo: [], forbiddenClaimsKo: [],
      supportedClaimBoundaryKo: null, unresolvedQuestionsKo: [], storySupportVerdict: null, generatedAt: "2026-10-03T00:00:00.000Z", editedAt: null, approvedAt: "2026-10-03T00:00:00.000Z", approvedVersion: 1,
      humanEdited: false, approvalSource: "ai_original", approvedBy: "human", generatedBy: "test", repairCount: 0, validationIssues: [] };
    persistCanonicalAssetToPackage({ packageRoot: root, asset: canonical });
    const draft = mutateNarration(root, candidateId, { action: "save", expectedRevision: null, expectedFingerprint: null, lineage: lineage(), sentences: SENTENCES.map(text => ({ sentenceId: null, text, purpose: null })) }, lineage);
    narrationView = mutateNarration(root, candidateId, { action: "approve", expectedRevision: draft.revision, expectedFingerprint: draft.fingerprint, lineage: lineage() }, lineage);
    const profile = resolveTtsProfile("standard-ko-development");
    const job = queueNarrationAudio({ root, candidateId, expectedRevision: narrationView.revision, expectedFingerprint: narrationView.fingerprint, lineage: lineage(), profile, endpointIdentity: "http://127.0.0.1:13900" });
    const done = await runNarrationAudioJob({ root, jobId: job.jobId, provider: provider(profile.profileId), durationProbe: createFfprobeDurationProbe(), profile, endpointIdentity: "http://127.0.0.1:13900", getLineage: lineage });
    if (done.contract !== "narration-audio-job-v2") throw new Error("v2 expected"); audio = done;
    await buildScenesAndMotion(); approveCaptionsAndHook(); health();
  }, 300_000);
  afterAll(() => { hook.armed = null; rmSync(root, { recursive: true, force: true }); rmSync(fixtures, { recursive: true, force: true }); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("1. compatibility: no selection file → v3 fingerprint is the HEAD formula; an all-image selection file changes nothing; the v3 render completes", async () => {
    expect(existsSync(join(root, "context/narration/visual-sources/selection.json"))).toBe(false);
    const before = final(); expect(before.reason).toBeNull(); v3Fingerprint = before.inputFingerprint!;
    health(); const job = queueCaptionShortform(root, candidateId, plan().fingerprint, v3Fingerprint, "final");
    expect(job.contract).toBe("narration-shortform-render-job-v3"); expect(job.inputFingerprint).toBe(v3Fingerprint);
    expect(sceneHash({ contract: "narration-shortform-input-v3", candidateId: job.candidateId, planFingerprint: job.plan.fingerprint, timeline: job.timeline, images: job.images,
      motionAssets: job.motionAssets, renderConfig: job.renderConfig, purpose: job.purpose, captionPlan: job.captionPlan, hook: job.hook, audioReview: job.audioReview })).toBe(v3Fingerprint);
    chooseImage(); expect(readSelection(root)!.scenes.every(s => s.source === "image_motion")).toBe(true);
    expect(final().inputFingerprint).toBe(v3Fingerprint);
    const done = await runCaptionShortform(root, job.jobId); expect(done.status).toBe("completed");
    expect(requireCaptionShortformOutput(root, candidateId, job.jobId).job.contract).toBe("narration-shortform-render-job-v3");
  }, 600_000);

  it("6a. no provider call on screen entry or stored-result reads; documented search, cache reuse, exclusions; missing place metadata is not a mismatch", { timeout: 120_000 }, async () => {
    const calls = net.log.length;
    visualSourcesView(root, candidateId); captionShortformSourceView(root, candidateId); motionView(root, candidateId);
    expect(net.log.length).toBe(calls);
    savePlan(null); expect(net.log.length).toBe(calls);
    const first = await search(); expect(providerCalls()).toBe(2); expect(first.attempts.map(a => [a.provider, a.status])).toEqual([["pexels", "ok"], ["pixabay", "ok"]]);
    // Provider rank (RRF) plus metadata evidence: 1001's title names the crossing action; 2001's tags name only half of the subject (crosswalk, no pedestrians), so provider rank decides the rest.
    expect(first.candidates.map(c => `${c.provider}:${c.videoId}`)).toEqual(["pexels:1001", "pixabay:2001", "pexels:1003", "pexels:1004", "pexels:1005"]);
    expect(first.excluded).toEqual(expect.arrayContaining([{ provider: "pexels", videoId: "1006", reasons: ["excessive_crop"] }, { provider: "pixabay", videoId: "2002", reasons: ["too_short"] }]));
    expect(first.shownCount).toBe(3); expect(first.candidates.every(c => c.placeEvidence === null)).toBe(true);
    expect(await search()).toEqual(first); expect(providerCalls()).toBe(2);
    rmSync(join(root, "context/narration/visual-sources/search"), { recursive: true });
    const cached = await search(); expect(cached.attempts.every(a => a.status === "cache_hit")).toBe(true); expect(providerCalls()).toBe(2);
    visualSourcesView(root, candidateId); expect(providerCalls()).toBe(2);
    expect(net.log.filter(l => l.kind === "blocked")).toEqual([]);
  });

  it("4. real ffmpeg, CFR source with audio and non-zero start: exact frames, 720×1280, 30fps, silent, range follows source time (no loop/freeze/slow motion)", async () => {
    const result = select("pexels", "1001", 2000, GENERIC); expect(result.queued).toBe(true);
    const job = current(); const entry = JSON.parse(readFileSync(join(queue, `${job.jobId}.json`), "utf8"));
    expect(entry).toMatchObject({ kind: "stock-clip-v1", root, jobId: job.jobId });
    expect(job.downloadUrl).toBe(URL_1001); expect(JSON.stringify(readSelection(root))).not.toContain("video-files");
    const done = await runStockClipJob(root, job.jobId); expect(done).toMatchObject({ status: "completed", errorCode: null });
    const frames = frames0(); const probe = probeStreams(clipPath(done));
    expect(probe.streams).toHaveLength(1); expect(probe.streams[0]).toMatchObject({ codec_type: "video", width: 720, height: 1280, r_frame_rate: "30/1", nb_read_frames: String(frames) });
    expect(done.original).toMatchObject({ width: 1080, height: 1920, hadAudio: true });
    const lumas = frameLumas(clipPath(done)); expect(lumas).toHaveLength(frames);
    // Frame k must be source frame 60 + k (2.000s at 30fps) for the whole range: a loop, freeze, slow motion or a shifted start drifts away.
    const error = (shift: number) => Math.max(...lumas.map((l, k) => Math.abs(l - refA[60 + shift + k]!)));
    expect(error(0)).toBeLessThanOrEqual(1); expect(error(-1)).toBeGreaterThan(error(0)); expect(error(1)).toBeGreaterThan(error(0));
    const provenance = JSON.parse(readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: done.output!.provenanceRelativePath }), "utf8"));
    expect(provenance).toMatchObject({ provider: "pexels", videoId: "1001", usedRange: { startMs: 2000, frameCount: frames }, placeReview: GENERIC, originalSha256: done.original!.sha256 });
    expect(JSON.stringify(provenance)).not.toContain("fixture-pexels-key");
    approve(done); expect(current().approval).not.toBeNull();
  }, 300_000);

  it("2. independence: search-plan edits, re-search and cache expiry keep the selected clip usable and approvable; the v4 fingerprint does not move", async () => {
    const approved = current(); const v4 = final(); expect(v4.reason).toBeNull(); expect(v4.inputFingerprint).not.toBe(v3Fingerprint);
    health(); const queued = queueCaptionShortform(root, candidateId, plan().fingerprint, v4.inputFingerprint!, "final"); expect(queued.contract).toBe("narration-shortform-render-job-v4");
    // The search plan now asks for a specific place. That applies to new selections only; this clip keeps its own snapshot.
    savePlan("Myeongdong"); const research = await search(); expect(providerCalls()).toBe(4);
    const evidence = Object.fromEntries(research.candidates.map(c => [c.videoId, c.placeEvidence]));
    expect(evidence["1001"]).toBeNull(); expect(evidence["2001"]).toBeNull(); expect(evidence["1003"]).toEqual({ field: "page_url", matchedText: "myeongdong street at night" });
    expect(stockClipJobFresh(root, approved)).toBe(true); expect(final().inputFingerprint).toBe(v4.inputFingerprint);
    // Reviews, a supplement, a next page, revealing stored candidates and a new session are search records only.
    const selectionBefore = readSelection(root)!.fingerprint;
    reviewCandidate(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, visualId: v0(), provider: "pexels", videoId: "1001", verdict: "reject", reason: "place_culture_mismatch", note: "명동이 아님" });
    setSceneNoSuitable(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, visualId: v0(), noSuitable: true, note: null });
    revealMoreCandidates(root, candidateId, target()); expect(providerCalls()).toBe(4);
    await runSupplement(root, candidateId, { ...target(), proposalId: null, changeReason: "장소명 검색 결과가 적어 피사체 동의어로 보완", queries: [{ text: "pedestrians crossing road", strategy: "synonym", purpose: "보행자 동의어" }] });
    expect(providerCalls()).toBe(6);
    await fetchNextPage(root, candidateId, target()); expect(providerCalls()).toBe(10);
    // A new session reuses the 24h cache: no request is sent and the attempt says so.
    await search(true); expect(providerCalls()).toBe(10);
    const attempts = readAttemptLog(root, plan().fingerprint, v0()); expect(attempts.at(-1)!.totals).toMatchObject({ networkRequests: 0, cacheHits: 2 });
    expect(attempts.map(a => a.kind)).toEqual(["initial", "initial", "initial", "supplement", "next_page", "initial"]);
    // Reading the per-revision query history is read-only: it shows earlier plans without touching selection or approvals.
    expect(readQueryHistory(root, plan(), v0()).revisions.filter(r => r.rows.some(row => row.ran)).length).toBeGreaterThan(1); expect(providerCalls()).toBe(10);
    expect(readSelection(root)!.fingerprint).toBe(selectionBefore); expect(current().approval).toEqual(approved.approval);
    expect(stockClipJobFresh(root, approved)).toBe(true); expect(final().inputFingerprint).toBe(v4.inputFingerprint);
    setSceneNoSuitable(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, visualId: v0(), noSuitable: false, note: null });
    rmSync(join(root, ".stock-cache"), { recursive: true }); rmSync(join(root, "context/narration/visual-sources/search"), { recursive: true });
    expect(readSceneSearch(root, plan().fingerprint, v0())).toBeNull();
    expect(stockClipJobFresh(root, approved)).toBe(true); expect(final().inputFingerprint).toBe(v4.inputFingerprint);
    expect(captionShortformFresh(root, readCaptionShortformJob(root, queued.jobId))).toBe(true);
    const reapproved = approve(approved); expect(reapproved.approval).not.toBeNull(); expect(readSelection(root)!.scenes[0]).toMatchObject({ source: "stock_video", placeReview: GENERIC });
    expect(final().inputFingerprint).toBe(v4.inputFingerprint);
    expect(net.log.filter(l => l.kind === "blocked")).toEqual([]);
  }, 300_000);

  it("2b. a URL-only refresh keeps the approval; a changed original SHA or record invalidates it", () => {
    const job = current(); const before = final().inputFingerprint;
    writeStockClipJob(root, { ...job, downloadUrl: `${URL_1001}?refreshed=1` });
    writeLocator(root, v0(), { ...readLocators(root)[v0()]!, downloadUrl: `${URL_1001}?refreshed=1`, capturedAt: new Date().toISOString() });
    expect(current().approval).toEqual(job.approval); expect(stockClipJobFresh(root, current())).toBe(true); expect(final().inputFingerprint).toBe(before);
    health(); expect(makeStockClip(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, expectedSelectionFingerprint: selectionFingerprint()!, visualId: v0() }).jobId).toBe(job.jobId);
    const originalPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.original!.relativePath }); const originalBytes = readFileSync(originalPath);
    writeFileSync(originalPath, Buffer.concat([originalBytes, Buffer.from([0])]));
    expect(() => requireStockClipOutput(root, candidateId, job.jobId, true)).toThrow("원본"); expect(final().inputFingerprint).toBeNull();
    expect(visualSourcesView(root, candidateId).scenes[0]!.clip).toMatchObject({ status: "failed", approved: false });
    writeFileSync(originalPath, originalBytes); expect(final().inputFingerprint).toBe(before);
    const jobFile = join(root, "context/narration/visual-sources/clips/jobs", `${job.jobId}.json`); const record = readFileSync(jobFile);
    const changed = JSON.parse(record.toString("utf8")); changed.original.sha256 = "0".repeat(64); writeFileSync(jobFile, JSON.stringify(changed));
    expect(() => readStockClipJob(root, job.jobId)).toThrow("연결 정보"); expect(final().inputFingerprint).toBeNull(); expect(final().reason).toContain("스톡 영상이 선택되어");
    writeFileSync(jobFile, record); expect(final().inputFingerprint).toBe(before);
  }, 120_000);

  it("2c. changing the selection's place requirement is an explicit update: old clip stale, approval gone, original reused; a range change also needs re-approval", async () => {
    const old = current(); const before = final().inputFingerprint; const fetched = downloads();
    health(); const updated = updateStockPlaceReview(root, candidateId, { expectedPlanFingerprint: plan().fingerprint, expectedSelectionFingerprint: selectionFingerprint()!, visualId: v0(), placeReview: SPECIFIC });
    expect(updated.queueMessage).toBeNull();
    expect(updated.selection.scenes[0]).toMatchObject({ placeReview: { placeRequirement: "specific_place", placeName: "Myeongdong", metadataEvidence: null, humanConfirmation: { evidenceUrl: (SPECIFIC as { evidenceUrl: string }).evidenceUrl } } });
    expect(stockClipJobFresh(root, readStockClipJob(root, old.jobId))).toBe(false); expect(readStockClipJob(root, old.jobId).approval).toBeNull();
    expect(final().inputFingerprint).toBeNull();
    const next = current(); expect(next.jobId).not.toBe(old.jobId); expect(next.downloadUrl).toBe(`${URL_1001}?refreshed=1`);
    const done = await runStockClipJob(root, next.jobId); expect(done.status).toBe("completed"); expect(downloads()).toBe(fetched);
    expect(done.original!.sha256).toBe(old.original!.sha256);
    expect(JSON.parse(readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: done.output!.provenanceRelativePath }), "utf8")).placeReview).toMatchObject({ placeRequirement: "specific_place", metadataEvidence: null });
    approve(done); const specificInput = final().inputFingerprint; expect(specificInput).not.toBeNull(); expect(specificInput).not.toBe(before);
    expect(existsSync(clipPath(old))).toBe(true);
    // A different range is a new input: the approval does not carry over, and going back does not revive it.
    await search(); select("pexels", "1001", 2500, SPECIFIC);
    expect(readStockClipJob(root, done.jobId).approval).toBeNull(); expect(current().jobId).not.toBe(done.jobId); expect(final().inputFingerprint).toBeNull();
    // Review fields are optional records: an unconfirmed specific-place selection is allowed and recorded as such.
    expect(select("pexels", "1001", 2500, { placeRequirement: "specific_place", placeName: "Myeongdong", sourceChecked: false, evidenceUrl: null, note: null }).queued).toBe(true);
    expect(readSelection(root)!.scenes[0]).toMatchObject({ placeReview: { placeRequirement: "specific_place", placeName: "Myeongdong", humanConfirmation: null } });
    expect(current().source.placeReview).toMatchObject({ humanConfirmation: null });
  }, 300_000);

  it("3. async: a queued or running A never overwrites B or an image-motion switch; late results are stale and old files stay", async () => {
    const a3 = current(); expect(a3.status).toBe("queued");
    select("pixabay", "2001", 2000, SPECIFIC); const b1 = current();
    const staleA = await runStockClipJob(root, a3.jobId); expect(staleA.status).toBe("stale"); expect(current().jobId).toBe(b1.jobId);
    expect(readSelection(root)!.scenes[0]).toMatchObject({ provider: "pixabay", videoId: "2001" });

    select("pexels", "1001", 2500, SPECIFIC); const running = current();
    hook.armed = { match: isNormalize, run: () => { select("pixabay", "2001", 2000, SPECIFIC); } };
    const lateA = await runStockClipJob(root, running.jobId); expect(hook.armed).toBeNull();
    expect(lateA.status).toBe("stale"); expect(readStockClipJob(root, running.jobId).status).toBe("stale");
    const b2 = current(); expect(b2.jobId).not.toBe(running.jobId); expect(b2.source).toMatchObject({ provider: "pixabay", videoId: "2001" }); expect(b2.status).toBe("queued");
    expect(existsSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: `media/narration-stock/${running.inputFingerprint}/${running.jobId}/scene.mp4` }))).toBe(true);

    // VFR source (20fps then 60fps): output is CFR 30fps with exact frames and follows source time across the switch.
    const b = await runStockClipJob(root, b2.jobId); expect(b.status).toBe("completed"); expect(b.original!.avgFrameRate).not.toBe("30/1");
    const frames = frames0(); const probe = probeStreams(clipPath(b));
    expect(probe.streams[0]).toMatchObject({ width: 720, height: 1280, r_frame_rate: "30/1", nb_read_frames: String(frames) }); expect(probe.streams).toHaveLength(1);
    const lumas = frameLumas(clipPath(b));
    // Below 3s the source only has a frame every 1/20s, so a held frame may lag real time by up to 1.5 output frames.
    lumas.forEach((l, k) => expect(Math.abs(l - refA[60 + k]!)).toBeLessThanOrEqual(3));
    lumas.slice(30).forEach((l, k) => expect(Math.abs(l - refA[90 + k]!)).toBeLessThanOrEqual(1));
    expect(net.log.filter(l => l.kind === "download").map(l => l.url)).toContain(URL_2001);

    // Image motion chosen while A normalizes: A ends stale and the render input is exactly the v3 one again.
    select("pexels", "1001", 2000, SPECIFIC); const a4 = current();
    hook.armed = { match: isNormalize, run: () => { chooseImage(); } };
    expect((await runStockClipJob(root, a4.jobId)).status).toBe("stale");
    expect(readSelection(root)!.scenes[0]).toEqual({ visualId: v0(), source: "image_motion" }); expect(final().inputFingerprint).toBe(v3Fingerprint);
  }, 600_000);

  it("3b. lock: retry exhaustion still settles the job; the lock is shared across processes and blocks API mutations", async () => {
    select("pexels", "1001", 2000, SPECIFIC); const a5 = current();
    hook.armed = { match: isDecodeCheck, run: () => { mkdirSync(lockDirectory()); } };
    const started = Date.now(); let settled: StockClipJob;
    try { settled = await runStockClipJob(root, a5.jobId); } finally { rmSync(lockDirectory(), { recursive: true, force: true }); }
    expect(Date.now() - started).toBeGreaterThanOrEqual(9_000); expect(settled.status).toBe("completed"); expect(readStockClipJob(root, a5.jobId).status).toBe("completed");

    revealMoreCandidates(root, candidateId, target()); select("pexels", "1004", 0, SPECIFIC); const corrupt = current();
    const holder = await holdLockInOtherProcess(4_000);
    expect(() => chooseImage()).toThrow("다른 저장이 진행 중"); expect(readSelection(root)!.scenes[0]).toMatchObject({ videoId: "1004" });
    const failed = await runStockClipJob(root, corrupt.jobId); expect(await holder.exited).toBe(0);
    const jobFile = join(root, "context/narration/visual-sources/clips/jobs", `${corrupt.jobId}.json`);
    expect(statSync(jobFile).mtimeMs).toBeGreaterThanOrEqual(holder.releasedAt() - 5);
    expect(failed).toMatchObject({ status: "failed", errorCode: "source_unreadable", output: null, original: null });
    expect(existsSync(lockDirectory())).toBe(false);
  }, 300_000);

  it("4b/5. failures are explicit: short source rejected without loop/freeze; no image fallback for a failed stock scene", async () => {
    select("pexels", "1005", 0, SPECIFIC); const short = current();
    const failed = await runStockClipJob(root, short.jobId);
    expect(failed).toMatchObject({ status: "failed", errorCode: "source_too_short", output: null });
    expect(existsSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: `media/narration-stock/${short.inputFingerprint}/${short.jobId}/scene.mp4` }))).toBe(false);
    const view = final(); expect(view.inputFingerprint).toBeNull(); expect(view.reason).toContain("스톡 영상이 선택되어"); expect(view.reason).toContain("이미지 모션 사용");
    expect(visualSourcesView(root, candidateId).scenes[0]!.clip).toMatchObject({ status: "failed", errorCode: "source_too_short" });
  }, 300_000);

  it("5. mixed render: stock needs no motion approval, image scenes do; queued/running selection changes give stale; final v4 MP4 has captions, hook and narration audio", async () => {
    // Each specific-place selection carries a new human confirmation, so it is a new clip input that is normalized and approved again.
    const chooseStock = async () => { select("pexels", "1001", 2000, SPECIFIC); const job = await runStockClipJob(root, current().jobId); expect(job.status).toBe("completed"); approve(job); return job; };
    let stock = await chooseStock();
    const [s0, s1] = plan().scenes.map(s => s.visualId); const s0Motion = motionJobFor(s0!); const s1Motion = motionJobFor(s1!);
    writeMotionJob(root, { ...s0Motion, approval: null }); expect(final().reason).toBeNull();
    writeMotionJob(root, { ...s1Motion, approval: null }); expect(final().inputFingerprint).toBeNull(); expect(final().reason).toContain("모션");
    writeMotionJob(root, s1Motion); expect(final().inputFingerprint).not.toBeNull();

    health(); const queued = queueCaptionShortform(root, candidateId, plan().fingerprint, final().inputFingerprint!, "final"); expect(queued.contract).toBe("narration-shortform-render-job-v4");
    chooseImage(); const staleQueued = await runCaptionShortform(root, queued.jobId); expect(staleQueued).toMatchObject({ status: "stale", output: null });
    stock = await chooseStock();

    health(); const running = queueCaptionShortform(root, candidateId, plan().fingerprint, final().inputFingerprint!, "final");
    hook.armed = { match: isRender, run: () => { chooseImage(); } };
    const staleRunning = await runCaptionShortform(root, running.jobId); expect(hook.armed).toBeNull();
    expect(staleRunning.status).toBe("stale"); expect(() => requireCaptionShortformOutput(root, candidateId, running.jobId)).toThrow("최신 완료 영상");
    stock = await chooseStock();

    health(); const job = queueCaptionShortform(root, candidateId, plan().fingerprint, final().inputFingerprint!, "final");
    expect(job.contract).toBe("narration-shortform-render-job-v4");
    const done = await runCaptionShortform(root, job.jobId); expect(done.status).toBe("completed");
    const { videoPath, output } = requireCaptionShortformOutput(root, candidateId, job.jobId);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,width,height,r_frame_rate,nb_read_frames,duration", "-of", "json", videoPath], { encoding: "utf8" })) as
      { streams: { codec_type: string; width?: number; height?: number; r_frame_rate?: string; nb_read_frames?: string; duration: string }[] };
    const video = probe.streams.find(s => s.codec_type === "video")!; const sound = probe.streams.find(s => s.codec_type === "audio");
    const layout = motionFrameLayout(done.plan);
    expect(video).toMatchObject({ width: 720, height: 1280, r_frame_rate: "30/1", nb_read_frames: String(layout.at(-1)!.endFrame) }); expect(sound).toBeDefined();
    expect(Math.abs(Number(sound!.duration) * 1000 - done.timeline.totalDurationMs)).toBeLessThanOrEqual(1000 / 30 + 50);
    const ass = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: output.assRelativePath }), "utf8");
    expect(ass.split("\n").filter(l => l.startsWith("Dialogue:") && l.includes(",Caption,"))).toHaveLength(readCaptionPlan(root, candidateId)!.cues.length);
    const hookLine = ass.split("\n").find(l => l.startsWith("Dialogue:") && l.includes(",Hook,"))!;
    expect(hookLine.split("}").slice(1).join("}").replace(/\\N/g, " ")).toBe(readOpeningHook(root, candidateId)!.text);
    // Above the hook/caption boxes the first scene is the stock clip's ramp and the next scene is the flat motion clip.
    const top = frameLumas(videoPath, "720:200:0:0"); const clip = frameLumas(clipPath(stock)); const n0 = layout[0]!.endFrame;
    for (let k = 0; k < n0; k++) expect(Math.abs(top[k]! - clip[k]!)).toBeLessThanOrEqual(3);
    const second = top.slice(n0, layout[1]!.endFrame); expect(Math.max(...second) - Math.min(...second)).toBeLessThan(2);
    expect(done.motionAssets[0]).toMatchObject({ sourceKind: "stock_clip", jobId: stock.jobId }); expect(done.motionAssets.slice(1).every(a => !("sourceKind" in a))).toBe(true);
    expect(net.log.filter(l => l.kind === "blocked")).toEqual([]);
  }, 900_000);
});
