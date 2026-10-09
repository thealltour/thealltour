import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
import { narrationGate, narrationLineage, NarrationError, readNarration } from "./persistence";
import { stableFingerprint } from "./fingerprint";
import { latestNarrationAudioJob } from "./audio";
import { captionFontMetrics } from "../narrationShortform/captionPlan";
import { wrapTextLines, SHORTFORM_LAYOUT_POLICY } from "../narrationShortform/layoutPolicy";
import { loadSceneSource, withSceneLock } from "../narrationScenes/service";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const OPENING_HOOK_CONTRACT = "narration-opening-hook-v1" as const;
/** Overlay text only: not a scene, voice or image. Authored manually (no AI generation). Renderers receive the validated template, never arbitrary coordinates. */
export const openingHookSchema = z.object({ contract: z.literal(OPENING_HOOK_CONTRACT), candidateId: z.string().min(1), revision: z.number().int().positive(), fingerprint: hash, contentFingerprint: hash,
  narrationRevision: z.number().int().positive(), narrationFingerprint: hash, sourceSentenceIds: z.array(z.string().uuid()).max(16), targetSentenceId: z.string().uuid(),
  text: z.string().max(80), enabled: z.boolean(), durationMs: z.number().int().min(1000).max(3000), templateId: z.literal("opening-top-v1"),
  approval: z.object({ contentFingerprint: hash, approvedRevision: z.number().int().positive(), approvedAt: z.string().datetime() }).strict().nullable(), updatedAt: z.string().datetime() }).strict();
const expected = { expectedRevision: z.number().int().positive().nullable(), expectedFingerprint: hash.nullable() };
export const openingHookMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), ...expected, text: z.string().max(80), enabled: z.boolean(), sourceSentenceIds: z.array(z.string().uuid()).max(16), durationMs: z.number().int().min(1000).max(3000).optional() }).strict(),
  z.object({ action: z.literal("approve"), expectedRevision: z.number().int().positive(), expectedFingerprint: hash }).strict(),
]);
export type OpeningHook = z.infer<typeof openingHookSchema>;
export type OpeningHookMutation = z.infer<typeof openingHookMutationSchema>;
type HookContent = Pick<OpeningHook, "candidateId" | "narrationRevision" | "narrationFingerprint" | "sourceSentenceIds" | "targetSentenceId" | "text" | "enabled" | "templateId">;
const hookPath = (root: string) => join(root, "context/narration/opening-hook/current.json");
/** What a reviewer approves. Display duration is excluded: re-timing or trimming re-validates display, never content. */
export const openingHookContentFingerprint = (hook: HookContent) => stableFingerprint({ contract: OPENING_HOOK_CONTRACT, candidateId: hook.candidateId, narrationRevision: hook.narrationRevision,
  narrationFingerprint: hook.narrationFingerprint, sourceSentenceIds: hook.sourceSentenceIds, targetSentenceId: hook.targetSentenceId, text: hook.text, enabled: hook.enabled, templateId: hook.templateId });
export const openingHookFingerprint = (hook: Omit<OpeningHook, "fingerprint" | "approval" | "updatedAt">) => stableFingerprint({ ...hook, contract: OPENING_HOOK_CONTRACT });
function approvedNarration(root: string, candidateId: string) {
  const canonical = readCanonicalAssetFromPackage(root); if (!canonical) throw new NarrationError("저장된 승인 원문을 찾을 수 없습니다.");
  const narration = readNarration(root, candidateId);
  if (!narration || narrationGate(narration, narrationLineage(canonical, root)) !== "approved") throw new NarrationError("Narration을 먼저 승인해주세요.");
  return narration;
}
export function readOpeningHook(root: string, candidateId: string): OpeningHook | null {
  if (!existsSync(hookPath(root))) return null;
  const hook = openingHookSchema.parse(JSON.parse(readFileSync(hookPath(root), "utf8")));
  const { fingerprint, approval, updatedAt, ...content } = hook; void approval; void updatedAt;
  if (hook.candidateId !== candidateId || fingerprint !== openingHookFingerprint(content) || hook.contentFingerprint !== openingHookContentFingerprint(hook)) throw new NarrationError("도입 문구 연결 정보가 다릅니다.", 409);
  return hook;
}
export const openingHookApproved = (hook: OpeningHook) => !!hook.approval && hook.approval.contentFingerprint === hook.contentFingerprint;
function hookIssues(hook: OpeningHook) {
  if (!hook.enabled) return null;
  if (!hook.text.trim()) return "핵심 발견 문구를 직접 입력하거나 ‘사용하지 않음’을 선택해주세요.";
  if (!hook.sourceSentenceIds.length) return "문구의 근거가 되는 Narration 문장을 하나 이상 선택해주세요.";
  return wrapTextLines(captionFontMetrics(), hook.text, "hook") ? null : "수정 필요: 도입 문구가 상단 영역 2줄(48px em)을 넘습니다. 글자를 줄이지 않으니 문구를 줄여주세요.";
}
/** Display check against the actual first scene; insufficient room needs a fix, it is never silently shortened in a final render. */
export function hookDisplayIssue(hook: Pick<OpeningHook, "enabled" | "durationMs">, firstSceneEndMs: number) {
  if (!hook.enabled || hook.durationMs <= firstSceneEndMs) return null;
  const seconds = (ms: number) => (ms / 1000).toFixed(1);
  return firstSceneEndMs < 1000 ? `수정 필요: 첫 장면이 ${seconds(firstSceneEndMs)}초로 도입 문구 최소 표시 시간(1.0초)보다 짧습니다. ‘사용하지 않음’을 선택해주세요.`
    : `수정 필요: 도입 문구 표시 시간 ${seconds(hook.durationMs)}초가 첫 장면 길이 ${seconds(firstSceneEndMs)}초보다 깁니다. 표시 시간을 ${seconds(Math.floor(firstSceneEndMs / 100) * 100)}초 이하로 줄여주세요.`;
}
/** First-scene end of the latest fresh audio timeline, or null when audio is not ready. */
export function currentFirstSceneEndMs(root: string, candidateId: string) {
  try { const latest = latestNarrationAudioJob(root, candidateId); if (!latest) return null; const { timeline } = loadSceneSource(root, candidateId, latest.jobId);
    return timeline.segments[1]?.startMs ?? timeline.totalDurationMs; } catch { return null; }
}
/** Final render needs approved content, an explicit choice for "not used", and a display time that fits the given first scene. Preview may show an unapproved valid hook. */
export function openingHookRenderState(root: string, candidateId: string, firstSceneEndMs: number | null = null) {
  const hook = readOpeningHook(root, candidateId);
  if (!hook) return { hook: null, fresh: false, issue: null, displayIssue: null, firstSceneEndMs, previewUsable: false, finalReady: false, reason: "핵심 발견 문구를 직접 작성해 승인하거나, ‘사용하지 않음’을 명시적으로 승인해주세요." };
  let fresh = false; let issue: string | null = null;
  try { const narration = approvedNarration(root, candidateId); fresh = narration.fingerprint === hook.narrationFingerprint && narration.revision === hook.narrationRevision &&
    hook.targetSentenceId === narration.sentences[0]?.sentenceId && hook.sourceSentenceIds.every(id => narration.sentences.some(s => s.sentenceId === id)); issue = hookIssues(hook); }
  catch (error) { issue = error instanceof NarrationError ? error.message : "도입 문구 입력을 확인해주세요."; }
  const displayIssue = firstSceneEndMs === null ? null : hookDisplayIssue(hook, firstSceneEndMs);
  const previewUsable = fresh && !issue; const approved = openingHookApproved(hook); const finalReady = previewUsable && approved && firstSceneEndMs !== null && !displayIssue;
  return { hook, fresh, issue, displayIssue, firstSceneEndMs, previewUsable, finalReady,
    reason: !fresh ? "Narration이 바뀌었습니다. 도입 문구를 다시 검토·승인해주세요." : issue ?? (!approved ? "도입 문구 승인이 필요합니다." : displayIssue ?? (firstSceneEndMs === null ? "최신 음성 타임라인이 필요합니다." : null)) };
}
export function openingHookView(root: string, candidateId: string) {
  const state = openingHookRenderState(root, candidateId, currentFirstSceneEndMs(root, candidateId));
  let firstSentence: { sentenceId: string; text: string; fits: boolean } | null = null; let sentences: { sentenceId: string; text: string }[] = [];
  try { const narration = approvedNarration(root, candidateId); const first = narration.sentences[0]!; const text = normalizeNarrationForTts(first.text);
    sentences = narration.sentences.map(s => ({ sentenceId: s.sentenceId, text: s.text }));
    // A verbatim import for manual editing; nothing is generated or compressed.
    firstSentence = { sentenceId: first.sentenceId, text: text.slice(0, 80), fits: text.length <= 80 && !!wrapTextLines(captionFontMetrics(), text, "hook") }; } catch { /* Requires approved Narration. */ }
  return { ...state, approved: !!state.hook && openingHookApproved(state.hook), firstSentence, sentences, authoring: "manual" as const,
    template: { templateId: SHORTFORM_LAYOUT_POLICY.hook.templateId, fontSize: SHORTFORM_LAYOUT_POLICY.hook.fontSize, maxLines: SHORTFORM_LAYOUT_POLICY.hook.maxLines, box: SHORTFORM_LAYOUT_POLICY.boxes.hook } };
}
export function mutateOpeningHook(root: string, candidateId: string, mutation: OpeningHookMutation) { return withSceneLock(root, () => mutateUnlocked(root, candidateId, mutation)); }
function mutateUnlocked(root: string, candidateId: string, mutation: OpeningHookMutation) {
  const current = readOpeningHook(root, candidateId);
  if ((current?.revision ?? null) !== mutation.expectedRevision || (current?.fingerprint ?? null) !== mutation.expectedFingerprint) throw new NarrationError("다른 화면에서 도입 문구가 변경되었습니다. 다시 불러와주세요.", 409);
  const narration = approvedNarration(root, candidateId);
  if (mutation.action === "approve") {
    const state = openingHookRenderState(root, candidateId); if (!current || !state.fresh) throw new NarrationError("최신 Narration 기준 도입 문구만 승인할 수 있습니다.", 409);
    if (state.issue) throw new NarrationError(state.issue, 409); if (openingHookApproved(current)) return current;
    const approved = { ...current, approval: { contentFingerprint: current.contentFingerprint, approvedRevision: current.revision, approvedAt: new Date().toISOString() } };
    atomicWriteFile(hookPath(root), JSON.stringify(openingHookSchema.parse(approved), null, 2), 0o600); return approved;
  }
  if (mutation.sourceSentenceIds.some(id => !narration.sentences.some(s => s.sentenceId === id)) || new Set(mutation.sourceSentenceIds).size !== mutation.sourceSentenceIds.length) throw new NarrationError("근거 문장은 현재 승인된 Narration 문장에서 골라주세요.", 400);
  const text = mutation.text.replace(/\s+/g, " ").trim();
  if (mutation.enabled && !text) throw new NarrationError("핵심 발견 문구를 직접 입력하거나 ‘사용하지 않음’을 선택해주세요.", 400);
  if (mutation.enabled && !mutation.sourceSentenceIds.length) throw new NarrationError("문구의 근거가 되는 Narration 문장을 하나 이상 선택해주세요.", 400);
  const base = { contract: OPENING_HOOK_CONTRACT, candidateId, narrationRevision: narration.revision, narrationFingerprint: narration.fingerprint,
    sourceSentenceIds: mutation.enabled ? mutation.sourceSentenceIds : [], targetSentenceId: narration.sentences[0]!.sentenceId, text: mutation.enabled ? text : "", enabled: mutation.enabled, templateId: SHORTFORM_LAYOUT_POLICY.hook.templateId };
  const content = { ...base, contentFingerprint: openingHookContentFingerprint(base), revision: current?.revision ?? 1, durationMs: mutation.durationMs ?? current?.durationMs ?? SHORTFORM_LAYOUT_POLICY.hook.defaultDurationMs };
  if (current && openingHookFingerprint(content) === current.fingerprint) return current;
  const next = { ...content, revision: (current?.revision ?? 0) + 1 };
  // A display-time-only edit keeps content approval; text, sources, enabled or Narration changes require re-approval.
  const approval = current && openingHookApproved(current) && current.contentFingerprint === next.contentFingerprint ? current.approval : null;
  const hook = openingHookSchema.parse({ ...next, fingerprint: openingHookFingerprint(next), approval, updatedAt: new Date().toISOString() });
  atomicWriteFile(hookPath(root), JSON.stringify(hook, null, 2), 0o600); return hook;
}
