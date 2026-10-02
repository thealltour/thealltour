import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { readNarration, narrationGate, narrationLineage, NarrationError } from "../narration/persistence";
import { audioConfigFingerprint, audioJobFresh, readNarrationAudioJob, resolveNarrationAudioProfile } from "../narration/audio";
import { parseVoiceStudioConfig } from "@/lib/marketing/tts/voiceStudio/config";
import { stableFingerprint } from "../narration/fingerprint";
import { narrationScenePlanSchema, sceneHandoffSchema, sceneAssetsSchema, type NarrationScenePlan, type SceneMutation, type SceneHandoff } from "./contracts";

export const sceneHash = stableFingerprint;
export const sceneDirectory = (root: string) => join(root, "context/narration/scenes");
export function scenePlanFingerprint(plan: Pick<NarrationScenePlan, "revision" | "source" | "scenes" | "totalDurationMs">) {
  return sceneHash({ contract: "narration-scene-plan-v1", revision: plan.revision, source: plan.source, scenes: plan.scenes, totalDurationMs: plan.totalDurationMs });
}
export function readScenePlan(root: string): NarrationScenePlan | null {
  const path = join(sceneDirectory(root), "current.json"); if (!existsSync(path)) return null;
  const plan = narrationScenePlanSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (scenePlanFingerprint(plan) !== plan.fingerprint || new Set(plan.scenes.map(s => s.sentenceId)).size !== plan.scenes.length ||
      plan.scenes.some((s, i) => s.order !== i || s.sceneId !== s.sentenceId || s.visualId !== s.sentenceId ||
        s.startMs >= s.speechEndMs || s.speechEndMs !== s.startMs + s.speechDurationMs || s.sceneEndMs < s.speechEndMs) ||
      (plan.approval && (plan.approval.revision !== plan.revision || plan.approval.fingerprint !== plan.fingerprint))) throw new NarrationError("장면 계획의 연결 정보가 일치하지 않습니다.", 500);
  return plan;
}
export function loadSceneSource(root: string, candidateId: string, audioJobId: string) {
  const canonical = readCanonicalAssetFromPackage(root);
  if (!canonical) throw new NarrationError("저장된 승인 원문을 찾을 수 없습니다.");
  const lineage = narrationLineage(canonical);
  const narration = readNarration(root, candidateId);
  if (!narration || narrationGate(narration, lineage) !== "approved") throw new NarrationError("현재 Narration을 먼저 승인해주세요.");
  const audio = readNarrationAudioJob(root, audioJobId);
  const config = audioConfigFingerprint(resolveNarrationAudioProfile(audio.profile.profileId), parseVoiceStudioConfig().baseUrl);
  if (audio.narration.candidateId !== candidateId || audio.status !== "completed" || !audio.timeline || !audioJobFresh(root, audio, lineage, config)) throw new NarrationError("현재 Narration의 최신 음성 작업이 필요합니다.");
  return { narration, timeline: audio.timeline, source: { candidateId, canonical: lineage,
    narrationRevision: narration.revision, narrationFingerprint: narration.fingerprint,
    audioJobId, audioConfigFingerprint: config, timelineFingerprint: sceneHash(audio.timeline) } };
}
export function scenePlanFresh(root: string, candidateId: string, plan: NarrationScenePlan) {
  try {
    const current = loadSceneSource(root, candidateId, plan.source.audioJobId);
    return sceneHash(current.source) === sceneHash(plan.source) &&
      plan.totalDurationMs === current.timeline.totalDurationMs && plan.scenes.length === current.narration.sentences.length &&
      plan.scenes.every((scene, i) => {
        const sentence = current.narration.sentences[i]!; const timing = current.timeline.segments[i]!;
        return scene.sentenceId === sentence.sentenceId && scene.sentenceText === sentence.text && scene.purpose === sentence.purpose &&
          scene.startMs === timing.startMs && scene.speechDurationMs === timing.durationMs && scene.speechEndMs === timing.endMs &&
          scene.sceneEndMs === (current.timeline.segments[i + 1]?.startMs ?? current.timeline.totalDurationMs);
      });
  } catch { return false; }
}
export function withSceneLock<T>(root: string, action: () => T): T {
  const directory = sceneDirectory(root); mkdirSync(directory, { recursive: true }); const lock = join(directory, ".mutation-lock");
  try { mkdirSync(lock); } catch { throw new NarrationError("다른 저장이 진행 중입니다. 잠시 후 다시 시도해주세요."); }
  try { return action(); } finally { rmSync(lock, { recursive: true }); }
}
export function buildSceneHandoff(plan: NarrationScenePlan): SceneHandoff {
  const content = { contract: "narration-astra-handoff-v1" as const, planRevision: plan.revision, planFingerprint: plan.fingerprint,
    source: plan.source, instructions: ["Generate exactly one unique 9:16 image per visualId, in the listed order.",
      "Never merge or split scenes, reuse an image, or change sentence/scene/visual IDs.",
      "Follow the approved visualPrompt. Narration is context, not a request to invent factual details.",
      "Return each image using its expectedFilename. Upload each image to its matching visualId slot."],
    visuals: plan.scenes.map(s => ({ sentenceId: s.sentenceId, sceneId: s.sceneId, visualId: s.visualId, order: s.order,
      sentenceText: s.sentenceText, visualPrompt: s.visualPrompt, aspectRatio: s.aspectRatio,
      expectedFilename: `${s.visualId}.png`, startMs: s.startMs, sceneEndMs: s.sceneEndMs })) };
  return sceneHandoffSchema.parse({ ...content, fingerprint: sceneHash(content) });
}
export function readSceneHandoff(root: string, plan: NarrationScenePlan): SceneHandoff | null {
  const path = join(sceneDirectory(root), `${plan.fingerprint}.handoff.json`);
  if (!existsSync(path)) return null;
  const handoff = sceneHandoffSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (sceneHash(handoff) !== sceneHash(buildSceneHandoff(plan))) throw new NarrationError("Astra 요청문과 현재 장면 계획이 일치하지 않습니다.", 409);
  return handoff;
}
export function requireFreshScenePlan(root: string, candidateId: string, expectedFingerprint: string) {
  const plan = readScenePlan(root);
  if (!plan || !plan.approval || plan.fingerprint !== expectedFingerprint || !scenePlanFresh(root, candidateId, plan)) throw new NarrationError("현재 승인된 장면 계획이 필요합니다.");
  return plan;
}
export function mutateScenePlan(root: string, candidateId: string, input: SceneMutation) {
  return withSceneLock(root, () => {
    const source = loadSceneSource(root, candidateId, input.audioJobId);
    if (source.narration.revision !== input.expectedNarrationRevision || source.narration.fingerprint !== input.expectedNarrationFingerprint) throw new NarrationError("Narration이 바뀌었습니다. 다시 불러와주세요.");
    const current = readScenePlan(root);
    if ((current?.revision ?? null) !== input.expectedRevision || (current?.fingerprint ?? null) !== input.expectedFingerprint) throw new NarrationError("장면 계획이 다른 화면에서 변경되었습니다. 다시 불러와주세요.");
    if (current && current.source.candidateId !== candidateId) throw new NarrationError("후보와 장면 계획이 일치하지 않습니다.", 409);
    if (input.action !== "save" && (!current || sceneHash(current.source) !== sceneHash(source.source))) throw new NarrationError("선택한 음성 작업 기준으로 장면 계획을 먼저 저장해주세요.");
    if (input.action === "handoff") {
      const plan = requireFreshScenePlan(root, candidateId, input.expectedFingerprint ?? ""); const handoff = buildSceneHandoff(plan);
      atomicWriteFile(join(sceneDirectory(root), `${plan.fingerprint}.handoff.json`), JSON.stringify(handoff, null, 2));
      return { plan, handoff };
    }
    let next: NarrationScenePlan;
    if (input.action === "approve") {
      if (!current || !scenePlanFresh(root, candidateId, current)) throw new NarrationError("최신 원문·음성 기준으로 장면 계획을 저장해주세요.");
      next = { ...current, approval: { revision: current.revision, fingerprint: current.fingerprint, approvedAt: new Date().toISOString() } };
    } else {
      if (!input.prompts || input.prompts.length !== source.narration.sentences.length || input.prompts.some((p, i) => p.sentenceId !== source.narration.sentences[i]!.sentenceId)) throw new NarrationError("각 문장에 순서대로 비주얼 계획 하나가 필요합니다.", 400);
      const scenes = source.narration.sentences.map((sentence, i) => {
        const timing = source.timeline.segments[i]!;
        return { sentenceId: sentence.sentenceId, sceneId: sentence.sentenceId, visualId: sentence.sentenceId, order: i,
          sentenceText: sentence.text, purpose: sentence.purpose, startMs: timing.startMs, speechDurationMs: timing.durationMs,
          speechEndMs: timing.endMs, sceneEndMs: source.timeline.segments[i + 1]?.startMs ?? source.timeline.totalDurationMs,
          visualPrompt: input.prompts![i]!.visualPrompt, aspectRatio: "9:16" as const, generatedVisualCount: 1 as const };
      });
      const content = { source: source.source, scenes, totalDurationMs: source.timeline.totalDurationMs };
      if (current && sceneHash(content) === sceneHash({ source: current.source, scenes: current.scenes, totalDurationMs: current.totalDurationMs })) return { plan: current, handoff: null };
      const revision = (current?.revision ?? 0) + 1;
      const fingerprint = scenePlanFingerprint({ revision, ...content });
      next = narrationScenePlanSchema.parse({ contract: "narration-scene-plan-v1", revision,
        fingerprint, ...content, createdAt: new Date().toISOString(), approval: null });
    }
    if (!scenePlanFresh(root, candidateId, next)) throw new NarrationError("저장 중 Narration 또는 음성이 바뀌었습니다.");
    if (current && next.revision !== current.revision) atomicWriteFile(join(sceneDirectory(root), "revisions", `${current.revision}-${current.fingerprint}.json`), JSON.stringify(current, null, 2));
    atomicWriteFile(join(sceneDirectory(root), "current.json"), JSON.stringify(next, null, 2));
    return { plan: next, handoff: null };
  });
}
export function readSceneAssets(root: string, plan: NarrationScenePlan) {
  const path = join(sceneDirectory(root), `${plan.fingerprint}.assets.json`);
  if (!existsSync(path)) return null;
  const assets = sceneAssetsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (assets.planFingerprint !== plan.fingerprint || assets.handoffFingerprint !== buildSceneHandoff(plan).fingerprint ||
      new Set(assets.assets.map(a => a.visualId)).size !== assets.assets.length || new Set(assets.assets.map(a => a.sha256)).size !== assets.assets.length ||
      assets.assets.some(a => a.planFingerprint !== plan.fingerprint || a.handoffFingerprint !== assets.handoffFingerprint ||
        a.sentenceId !== a.visualId || a.sceneId !== a.visualId || !plan.scenes.some(s => s.visualId === a.visualId))) throw new NarrationError("업로드 이미지 연결 정보가 일치하지 않습니다.", 500);
  return assets;
}
