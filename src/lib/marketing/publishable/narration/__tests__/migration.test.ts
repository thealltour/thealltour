// @vitest-environment node
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { narrationLineage, mutateNarration, readNarration, narrationGate } from "../persistence";
import { queueNarrationAudio, runNarrationAudioJob, audioJobFresh, audioConfigFingerprint } from "../audio";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { mutateScenePlan, buildSceneHandoff, scenePlanFresh } from "../../narrationScenes/service";
import { uploadSceneAsset } from "../../narrationScenes/assets";
import { mutateAdaptation, adaptationFresh } from "../../narrationInstagram/service";
import { queueShortformJob, shortformJobFresh } from "../../narrationShortform/service";
import { buildNarrationShortformArgs } from "../../narrationShortform/graph";
import { instagramMutationSchema } from "../../narrationInstagram/contracts";

let root: string;
let canonical: CanonicalMarketingAsset;
const candidateId = "migration-test";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "narration-migration-"));
  vi.stubEnv("VOICESTUDIO_BASE_URL", "http://127.0.0.1:13900");
  vi.stubEnv("NARRATION_TTS_PROFILE_JSON", "");
  canonical = { contract: "canonical-marketing-asset-v1", assetId: "cma-test", version: 1, status: "approved",
    agendaId: "agenda", storyPointId: "story", storyPointHash: "story-hash", evidenceBriefRef: null,
    evidenceRevision: "evidence-v1", contentPropositionRef: null, propositionRevision: "proposition-v1", sourceRevision: "source-v1",
    titleKo: "여행 일정 확인", dekKo: null, openingHookKo: "출발 조건을 확인합니다.", bodyKo: "일정과 조건을 확인합니다.",
    keyTakeawaysKo: [], decisionGuidanceKo: "공식 안내를 확인합니다.", optionalCtaIntentKo: null, evidenceRefs: [],
    limitationsKo: [], forbiddenClaimsKo: [], supportedClaimBoundaryKo: null, unresolvedQuestionsKo: [], storySupportVerdict: null,
    generatedAt: "2026-10-03T00:00:00.000Z", editedAt: null, approvedAt: "2026-10-03T00:00:00.000Z", approvedVersion: 1,
    humanEdited: false, approvalSource: "ai_original", approvedBy: "human", generatedBy: "test", repairCount: 0, validationIssues: [] };
  persistCanonicalAssetToPackage({ packageRoot: root, asset: canonical });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); vi.unstubAllEnvs(); });
const lineage = () => narrationLineage(canonical);
function draft(count = 4) {
  return mutateNarration(root, candidateId, { action: "save", expectedRevision: null, expectedFingerprint: null,
    lineage: lineage(), sentences: Array.from({ length: count }, (_, i) => ({ sentenceId: null, text: `문장 ${i + 1}입니다.`, purpose: null })) }, lineage);
}
async function scenes(count = 4) {
  const value = draft(count);
  mutateNarration(root, candidateId, { action: "approve", expectedRevision: value.revision, expectedFingerprint: value.fingerprint, lineage: lineage() }, lineage);
  const profile = resolveTtsProfile("standard-ko-development");
  const job = queueNarrationAudio({ root, candidateId, expectedRevision: value.revision, expectedFingerprint: value.fingerprint,
    lineage: lineage(), profile, endpointIdentity: "http://127.0.0.1:13900" });
  const provider: TtsProvider = { providerId: "voicestudio", generate: vi.fn(async input => {
    const audio = Buffer.alloc(32044); audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVEfmt ", 8);
    audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(16000, 24);
    audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write("data", 36); audio.writeUInt32LE(32000, 40);
    return { contract: "tts-generation-result-v1" as const, requestId: input.requestId, provider: "voicestudio" as const,
      profileId: profile.profileId, mediaType: "audio/wav" as const, format: "wav" as const, sampleRate: 16000, channels: 1,
      byteSize: audio.length, sha256: sha256Buffer(audio), providerGenerationId: null, providerReportedDurationMs: null,
      containerDurationMs: 1000, timelineAuthoritative: false as const, generatedAt: new Date().toISOString(), segmentId: input.segmentId ?? null,
      metadata: { modelRef: profile.modelRef, voiceRef: profile.voiceRef, httpStatus: 200 }, audio };
  }) };
  const audio = await runNarrationAudioJob({ root, jobId: job.jobId, provider, durationProbe: {
    probePersistedWav: async absolutePath => ({ absolutePath, durationMs: 1000, source: "persisted_wav_ffprobe" as const }) },
    profile, endpointIdentity: "http://127.0.0.1:13900", getLineage: lineage });
  expect(provider.generate).toHaveBeenCalledTimes(count);
  expect(audio.status).toBe("completed");
  const input = { audioJobId: audio.jobId, expectedNarrationRevision: value.revision, expectedNarrationFingerprint: value.fingerprint };
  const saved = mutateScenePlan(root, candidateId, { action: "save", ...input, expectedRevision: null, expectedFingerprint: null,
    prompts: value.sentences.map(s => ({ sentenceId: s.sentenceId, visualPrompt: "여행 조건을 확인하는 사람" })) }).plan;
  const plan = mutateScenePlan(root, candidateId, { action: "approve", ...input, expectedRevision: saved.revision, expectedFingerprint: saved.fingerprint }).plan;
  mutateScenePlan(root, candidateId, { action: "handoff", ...input, expectedRevision: plan.revision, expectedFingerprint: plan.fingerprint });
  const handoff = buildSceneHandoff(plan);
  for (const [i, scene] of plan.scenes.entries()) {
    const bytes = await sharp({ create: { width: 90, height: 160, channels: 3, background: { r: i * 15, g: 70, b: 100 } } }).png().toBuffer();
    await uploadSceneAsset({ root, candidateId, visualId: scene.visualId, bytes, planFingerprint: plan.fingerprint, handoffFingerprint: handoff.fingerprint });
  }
  return { plan, audio, profile, input };
}
describe("Narration migration gates", () => {
  it("preserves stable IDs/no-op approval, rejects lost updates and clears approval on reorder", () => {
    const first = draft(); const approved = mutateNarration(root, candidateId, { action: "approve", expectedRevision: first.revision, expectedFingerprint: first.fingerprint, lineage: lineage() }, lineage);
    const save = { action: "save" as const, expectedRevision: first.revision, expectedFingerprint: first.fingerprint, lineage: lineage(),
      sentences: first.sentences.map(({ sentenceId, text, purpose }) => ({ sentenceId, text, purpose })) };
    expect(mutateNarration(root, candidateId, save, lineage).approval).toEqual(approved.approval);
    const changed = mutateNarration(root, candidateId, { ...save, sentences: [...save.sentences].reverse() }, lineage);
    expect(changed.revision).toBe(2); expect(changed.approval).toBeNull(); expect(changed.sentences[0]!.sentenceId).toBe(first.sentences[3]!.sentenceId);
    expect(() => mutateNarration(root, candidateId, save, lineage)).toThrow("다른 화면");
    canonical = { ...canonical, forbiddenClaimsKo: ["확정 요금"] };
    expect(narrationGate(changed, lineage())).toBe("stale");
  });
  it("fails closed on duplicate IDs and tampered durable content", () => {
    const first = draft();
    expect(() => mutateNarration(root, candidateId, { action: "save", expectedRevision: first.revision, expectedFingerprint: first.fingerprint, lineage: lineage(),
      sentences: first.sentences.map(() => ({ sentenceId: first.sentences[0]!.sentenceId, text: "같은 ID입니다.", purpose: null })) }, lineage)).toThrow("중복");
    const path = join(root, "context/narration/current.json"); const json = JSON.parse(readFileSync(path, "utf8")); json.sentences[0].text = "변조"; writeFileSync(path, JSON.stringify(json));
    expect(() => readNarration(root, candidateId)).toThrow("연결 정보");
  });
  it("binds measured audio, 1:1 scenes and cards; a selected-image replacement stales card/render jobs", async () => {
    const { plan, audio, profile } = await scenes(6);
    expect(plan.totalDurationMs).toBe(7250); expect(plan.scenes[0]!.sceneEndMs).toBe(1250);
    expect(plan.scenes.every(s => s.sentenceId === s.sceneId && s.sceneId === s.visualId)).toBe(true);
    expect(audioJobFresh(root, audio, lineage(), audioConfigFingerprint({ ...profile, speed: 1.2 }, audio.endpointIdentity))).toBe(false);
    const cards = plan.scenes.slice(0, 4).map(s => ({ sceneId: s.sceneId, kicker: null, headline: "조건 확인", body: null, microcopy: null }));
    const saved = mutateAdaptation(root, candidateId, { action: "save", expectedRevision: null, expectedFingerprint: null, expectedScenePlanFingerprint: plan.fingerprint, cards }).adaptation!;
    expect(saved.cards).toHaveLength(4);
    const renderJob = queueShortformJob(root, candidateId, plan.fingerprint);
    expect(renderJob.plan.scenes).toHaveLength(6); expect(shortformJobFresh(root, renderJob)).toBe(true);
    const replacement = await sharp({ create: { width: 90, height: 160, channels: 3, background: "yellow" } }).png().toBuffer();
    await uploadSceneAsset({ root, candidateId, visualId: plan.scenes[0]!.visualId, bytes: replacement, planFingerprint: plan.fingerprint, handoffFingerprint: buildSceneHandoff(plan).fingerprint });
    expect(adaptationFresh(root, candidateId, saved)).toBe(false); expect(shortformJobFresh(root, renderJob)).toBe(false);
    canonical = { ...canonical, version: 2, approvedVersion: 2 }; persistCanonicalAssetToPackage({ packageRoot: root, asset: canonical });
    expect(scenePlanFresh(root, candidateId, plan)).toBe(false);
  });
  it("rejects duplicate/out-of-order cards, 3/11 cards and stale external inventory", async () => {
    const { plan } = await scenes(10);
    const cards = plan.scenes.map(s => ({ sceneId: s.sceneId, kicker: null, headline: "조건 확인", body: null, microcopy: null }));
    const base = { expectedRevision: null, expectedFingerprint: null, expectedScenePlanFingerprint: plan.fingerprint };
    expect(instagramMutationSchema.safeParse({ action: "save", ...base, cards: cards.slice(0, 3) }).success).toBe(false);
    expect(instagramMutationSchema.safeParse({ action: "save", ...base, cards: [...cards, cards[0]] }).success).toBe(false);
    expect(() => mutateAdaptation(root, candidateId, { action: "save", ...base, cards: [...cards.slice(0, 3), cards[0]!] })).toThrow("서로 다른");
    expect(() => mutateAdaptation(root, candidateId, { action: "save", ...base, cards: cards.slice(0, 4).reverse() })).toThrow("순서");
    const handoff = mutateAdaptation(root, candidateId, { action: "handoff", ...base }).handoff!;
    expect(() => mutateAdaptation(root, candidateId, { action: "import", ...base, result: { contract: "narration-instagram-chatgpt-result-v1", candidateId,
      source: handoff.source, baseRevision: null, baseFingerprint: null, visualInventoryFingerprint: "0".repeat(64), cards } })).toThrow("이미지");
  });
  it("keeps exactly one image/audio input per scene with measured duration and no shortest/18s shortcut", async () => {
    const { plan } = await scenes(); const job = queueShortformJob(root, candidateId, plan.fingerprint);
    const args = buildNarrationShortformArgs({ job, images: job.images.map((_, i) => `/tmp/image-${i}.png`), audio: job.timeline.segments.map((_, i) => `/tmp/audio-${i}.wav`), subtitlesPath: "/tmp/subtitles.srt", outputPath: "/tmp/output.mp4" });
    expect(args.filter(a => a === "-i")).toHaveLength(9); expect(args).not.toContain("-shortest");
    expect(args[args.indexOf("-t") + 1]).toBe("4.750"); expect(args[args.indexOf("-filter_complex") + 1]).toContain("adelay=1250|1250");
    expect(args[args.indexOf("-filter_complex") + 1]).toContain("concat=n=4");
  });
});
