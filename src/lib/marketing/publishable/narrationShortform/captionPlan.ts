import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { NarrationError } from "../narration/persistence";
import { latestNarrationAudioJob, processedAudioFingerprint, readNarrationAudioJob } from "../narration/audio";
import { loadSceneSource, sceneHash, withSceneLock } from "../narrationScenes/service";
import { loadFontMetrics, type FontMetrics } from "./fontMetrics";
import { layoutPolicyFingerprint, verifiedCaptionFont, wrapTextLines, SHORTFORM_LAYOUT_POLICY } from "./layoutPolicy";
import { assCentiseconds } from "./motionSubtitles";
import { CAPTION_DURATION, CAPTION_PLAN_CONTRACT, captionPlanSchema, type CaptionBulkApproval, type CaptionCue, type CaptionIssue, type CaptionMutation, type CaptionPlan } from "./captionContracts";
import { alignedCueTiming, alignmentReasonLabels, usableAlignment, type AlignmentJob, type AlignmentSentenceResult } from "./captionAlignment";

type Segment = AudioMasterTimeline["segments"][number];
type Range = [number, number];
const planPath = (root: string) => join(root, "context/narration/caption-plan/current.json");
const slice = (cps: string[], [start, end]: Range) => cps.slice(start, end).join("").trim();
export function captionFontMetrics(): FontMetrics {
  const font = verifiedCaptionFont(); const metrics = loadFontMetrics(font.path);
  if (metrics.sha256 !== font.sha256) throw new NarrationError("자막 글꼴 파일이 측정 중에 바뀌었습니다. 다시 시도해주세요.", 503);
  return metrics;
}
export function captionFingerprint(plan: Pick<CaptionPlan, "candidateId" | "revision" | "lineage" | "layoutPolicyId" | "layoutPolicyFingerprint" | "fontFileSha256" | "cues" | "alignment">) {
  return sceneHash({ contract: CAPTION_PLAN_CONTRACT, candidateId: plan.candidateId, revision: plan.revision, lineage: plan.lineage, layoutPolicyId: plan.layoutPolicyId,
    layoutPolicyFingerprint: plan.layoutPolicyFingerprint, fontFileSha256: plan.fontFileSha256, cues: plan.cues, ...(plan.alignment ? { alignment: plan.alignment } : {}) });
}
export function captionSource(root: string, candidateId: string) {
  const audioJobId = latestNarrationAudioJob(root, candidateId)?.jobId; if (!audioJobId) throw new NarrationError("현재 Narration의 음성 작업이 필요합니다.");
  const scene = loadSceneSource(root, candidateId, audioJobId); const metrics = captionFontMetrics();
  return { timeline: scene.timeline, metrics, layoutPolicyFingerprint: layoutPolicyFingerprint(), fontFileSha256: metrics.sha256,
    lineage: { narrationRevision: scene.narration.revision, narrationFingerprint: scene.narration.fingerprint, audioJobId, audioTimelineFingerprint: scene.source.timelineFingerprint,
      processedAudioFingerprint: processedAudioFingerprint(readNarrationAudioJob(root, audioJobId)), normalizedTextFingerprint: sceneHash(scene.timeline.segments.map(s => s.text)) } };
}
/** Character-weighted split of the sentence's measured speech span. Always labeled estimated; never presented as aligned timestamps. */
function estimateTimes(segment: Segment, ranges: Range[]) {
  const cps = [...segment.text]; const weight = (end: number) => cps.slice(0, end).filter(c => c.trim()).length; const total = weight(cps.length) || 1;
  const at = (end: number) => segment.startMs + Math.round(segment.durationMs * weight(end) / total);
  return ranges.map(([start, end], i) => ({ startMs: i ? at(start) : segment.startMs, endMs: i === ranges.length - 1 ? segment.endMs : at(end) }));
}
/** Splits only inside one sentence: by line fit and estimated duration, preferring punctuation. Never shrinks type. */
export function proposeSentenceRanges(segment: Segment, metrics: FontMetrics): Range[] {
  const cps = [...segment.text]; const nonSpace = (a: number, b: number) => cps.slice(a, b).filter(c => c.trim()).length; const total = nonSpace(0, cps.length) || 1;
  const est = (a: number, b: number) => segment.durationMs * nonSpace(a, b) / total; const fits = (range: Range) => wrapTextLines(metrics, slice(cps, range), "caption") !== null;
  const oneLine = (range: Range) => wrapTextLines(metrics, slice(cps, range), "caption")?.length === 1;
  const units: Range[] = [];
  for (let i = 0; i < cps.length;) {
    let j = i; while (j < cps.length && cps[j] !== " ") j++; while (j < cps.length && cps[j] === " ") j++;
    if (oneLine([i, j])) units.push([i, j]);
    else { let start = i; for (let k = i + 1; k <= j; k++) if (!oneLine([start, k]) && k - 1 > start) { units.push([start, k - 1]); start = k - 1; } units.push([start, j]); }
    i = j;
  }
  const ranges: Range[] = []; let start = units[0]![0]; let end = start;
  for (const [a, b] of units) {
    if (end > start) {
      const overflow = !fits([start, b]) || est(start, b) > CAPTION_DURATION.targetMaxMs;
      const pause = /[,.?!…·:;]$/.test(slice(cps, [start, end])) && est(start, end) >= CAPTION_DURATION.targetMinMs && est(end, cps.length) >= CAPTION_DURATION.allowedMinMs;
      if (overflow || pause) { ranges.push([start, end]); start = a; }
    }
    end = b;
  }
  ranges.push([start, cps.length]);
  const last = ranges.at(-1)!; const previous = ranges.at(-2);
  if (previous && est(...last) < CAPTION_DURATION.allowedMinMs && fits([previous[0], last[1]]) && est(previous[0], last[1]) <= CAPTION_DURATION.allowedMaxMs) ranges.splice(-2, 2, [previous[0], last[1]]);
  return ranges;
}
function rangesFromTexts(segment: Segment, texts: string[]): Range[] {
  const cps = [...segment.text]; const starts: number[] = []; let p = 0;
  const fail = () => new NarrationError("자막 cue를 이어 붙이면 원래 문장과 같아야 합니다. 문장 안에서 나누기만 할 수 있습니다.", 400);
  for (const text of texts) {
    const target = text.replace(/\s+/g, " ").trim(); while (cps[p] === " ") p++; const length = [...target].length;
    if (!length || cps.slice(p, p + length).join("") !== target) throw fail(); starts.push(p); p += length;
  }
  while (cps[p] === " ") p++; if (p !== cps.length) throw fail();
  return starts.map((start, i) => [i ? start : 0, starts[i + 1] ?? cps.length]);
}
export function validateCaptionCues(cues: CaptionCue[], timeline: AudioMasterTimeline, metrics: FontMetrics): CaptionIssue[] {
  const issues: CaptionIssue[] = []; const order = new Map(timeline.segments.map((s, i) => [s.segmentId, i]));
  const add = (severity: CaptionIssue["severity"], code: string, cue: CaptionCue | null, message: string, sentenceId = cue?.sentenceId ?? null) => issues.push({ severity, code, cueId: cue?.cueId ?? null, sentenceId, message });
  let current = -1; let covered = 0;
  const close = () => { const segment = timeline.segments[current]; if (segment && covered !== [...segment.text].length) add("error", "sentence_not_covered", null, "문장 전체가 자막 cue로 덮이지 않았습니다.", segment.segmentId); };
  for (const [i, cue] of cues.entries()) {
    const index = order.get(cue.sentenceId); if (index === undefined) { add("error", "unknown_sentence", cue, "현재 Narration에 없는 문장입니다."); continue; }
    if (index !== current) { close(); if (index !== current + 1) add("error", "sentence_order", cue, "문장 순서가 Narration과 다르거나 빠진 문장이 있습니다."); current = index; covered = 0; }
    const segment = timeline.segments[index]!; const cps = [...segment.text];
    if (cue.ordinal !== i + 1) add("error", "ordinal", cue, "cue 순번이 연속되지 않습니다.");
    if (cue.sourceStart !== covered || cue.sourceEnd <= cue.sourceStart || cue.sourceEnd > cps.length) add("error", "source_range", cue, "cue 원문 범위가 문장 안에서 연속되지 않습니다.");
    else if (cue.text !== slice(cps, [cue.sourceStart, cue.sourceEnd])) add("error", "text_mismatch", cue, "cue 문구가 Narration 원문과 다릅니다.");
    covered = cue.sourceEnd;
    if (cue.startMs < segment.startMs || cue.endMs > segment.endMs) add("error", "outside_sentence_speech", cue, "cue가 해당 문장 음성 구간을 벗어납니다.");
    if (cue.endMs <= cue.startMs || assCentiseconds(cue.startMs) >= assCentiseconds(cue.endMs)) add("error", "zero_length", cue, "cue 길이가 0이거나 반올림 후 사라집니다.");
    const previous = cues[i - 1];
    if (previous && (cue.startMs < previous.endMs || assCentiseconds(cue.startMs) < assCentiseconds(previous.endMs))) add("error", "overlap", cue, "앞 cue와 시간이 겹칩니다.");
    const duration = cue.endMs - cue.startMs;
    if (duration > CAPTION_DURATION.allowedMaxMs) add("error", "too_long", cue, "cue가 3.5초를 넘습니다. 더 나눠주세요.");
    else if (duration < CAPTION_DURATION.allowedMinMs) add("warning", "too_short", cue, "cue가 0.8초보다 짧습니다. 읽을 수 있는지 확인해주세요.");
    else if (duration < CAPTION_DURATION.targetMinMs || duration > CAPTION_DURATION.targetMaxMs) add("warning", "outside_target", cue, "권장 길이(1.0~2.8초) 밖입니다.");
    if (!wrapTextLines(metrics, cue.text, "caption")) add("error", "layout_overflow", cue, "자막 영역의 2줄 안에 들어가지 않습니다. 글자를 줄이지 않으니 더 나눠주세요.");
  }
  close(); if (current !== timeline.segments.length - 1) add("error", "sentence_missing", null, "자막이 없는 문장이 있습니다.");
  return issues;
}
export function readCaptionPlan(root: string, candidateId: string): CaptionPlan | null {
  if (!existsSync(planPath(root))) return null;
  const plan = captionPlanSchema.parse(JSON.parse(readFileSync(planPath(root), "utf8")));
  if (plan.candidateId !== candidateId || plan.fingerprint !== captionFingerprint(plan)) throw new NarrationError("자막 계획 연결 정보가 다릅니다.", 409);
  return plan;
}
export const captionApproved = (plan: CaptionPlan) => !!plan.approval && plan.approval.fingerprint === plan.fingerprint && plan.approval.revision === plan.revision;
function sourceMatches(plan: CaptionPlan, source: ReturnType<typeof captionSource>) {
  return sceneHash(plan.lineage) === sceneHash(source.lineage) && plan.layoutPolicyFingerprint === source.layoutPolicyFingerprint && plan.fontFileSha256 === source.fontFileSha256;
}
const alignedFor = (job: AlignmentJob | null, sentenceId: string): AlignmentSentenceResult | null => job?.result?.sentences.find(s => s.sentenceId === sentenceId) ?? null;
/**
 * forced_alignment cues must equal what the current usable alignment gives for their range (else error: re-apply);
 * sentences whose alignment needs review, and cues whose boundary could not be confirmed, are warnings that must be acknowledged.
 */
function alignmentIssues(plan: CaptionPlan, timeline: AudioMasterTimeline, job: AlignmentJob | null): CaptionIssue[] {
  const issues: CaptionIssue[] = [];
  for (const segment of timeline.segments) {
    const cues = plan.cues.filter(c => c.sentenceId === segment.segmentId); const result = alignedFor(job, segment.segmentId);
    const timing = alignedCueTiming(segment, cues.map(c => [c.sourceStart, c.sourceEnd]), result);
    cues.forEach((cue, i) => {
      if (cue.timingSource === "forced_alignment" && (!timing || timing.times[i]!.startMs !== cue.startMs || timing.times[i]!.endMs !== cue.endMs))
        issues.push({ severity: "error", code: "alignment_stale", cueId: cue.cueId, sentenceId: cue.sentenceId, message: "이 cue 시간을 만든 정렬 결과가 현재 음성·문장·cue 나눔과 맞지 않습니다. 정렬 결과를 다시 적용해주세요." });
      else if (cue.timingSource === "forced_alignment" && timing!.flags[i]!.length)
        issues.push({ severity: "warning", code: "alignment_boundary", cueId: cue.cueId, sentenceId: cue.sentenceId, message: `정렬 확인 필요: ${timing!.flags[i]!.map(f => alignmentReasonLabels[f] ?? f).join(", ")}.` });
      if (result && result.status !== "verified")
        issues.push({ severity: "warning", code: "alignment_review", cueId: cue.cueId, sentenceId: cue.sentenceId,
          message: `정렬 검토 필요: ${result.reasons.map(r => alignmentReasonLabels[r] ?? r).join(", ")}. ${cue.timingSource === "manual" ? "직접 입력한 시간을 사용합니다." : "정렬 시간 대신 추정 시간을 사용합니다."}` });
    });
  }
  return issues;
}
/** Cues the reviewer must look at before a one-step approval: any warning, or times that are still estimates. */
export function captionAttention(plan: CaptionPlan, issues: CaptionIssue[]) {
  const attention = new Map<string, string[]>();
  for (const cue of plan.cues) {
    const reasons = issues.filter(i => i.cueId === cue.cueId && i.severity === "warning").map(i => i.message);
    if (cue.timingSource === "estimated") reasons.push("추정 시간입니다. 실제 발화 위치와 다를 수 있습니다.");
    if (reasons.length) attention.set(cue.cueId, reasons);
  }
  return attention;
}
/** Preview may use unreviewed estimated cues; final requires approval with every cue reviewed and no validation error. */
export function captionRenderState(root: string, candidateId: string) {
  const plan = readCaptionPlan(root, candidateId); if (!plan) return { plan: null, fresh: false, issues: [] as CaptionIssue[], previewReady: false, finalReady: false, reason: "자막 cue 계획을 먼저 만들어주세요." };
  let source: ReturnType<typeof captionSource>;
  try { source = captionSource(root, candidateId); } catch (error) { return { plan, fresh: false, issues: [] as CaptionIssue[], previewReady: false, finalReady: false, reason: error instanceof NarrationError ? error.message : "자막 입력을 확인해주세요." }; }
  const fresh = sourceMatches(plan, source); const issues = fresh ? [...validateCaptionCues(plan.cues, source.timeline, source.metrics), ...alignmentIssues(plan, source.timeline, usableAlignment(root, candidateId))] : [];
  const previewReady = fresh && !issues.some(i => i.severity === "error"); const unreviewed = plan.cues.filter(c => !c.reviewed).length;
  const finalReady = previewReady && unreviewed === 0 && captionApproved(plan);
  const layoutOnly = !fresh && sceneHash(plan.lineage) === sceneHash(source.lineage) && plan.fontFileSha256 === source.fontFileSha256;
  const reason = layoutOnly ? "자막 배치 기준(글자 크기 해석)이 바뀌었습니다. 자막 cue를 다시 만들면 새 기준에도 맞는 cue는 검토 표시가 유지되고, 다시 나눈 cue만 검토가 필요합니다."
    : !fresh ? "Narration·음성·배치·글꼴이 바뀌었습니다. 자막 cue를 다시 만들어주세요." : !previewReady ? "자막 cue 오류를 먼저 고쳐주세요." :
    unreviewed ? `검토하지 않은 자막 cue ${unreviewed}개가 있습니다. 최종 영상 전 검토가 필요합니다.` : !captionApproved(plan) ? "자막 cue 승인이 필요합니다." : null;
  return { plan, fresh, issues, previewReady, finalReady, reason };
}
export function captionPlanView(root: string, candidateId: string) {
  const state = captionRenderState(root, candidateId); let metrics: FontMetrics | null = null; try { metrics = captionFontMetrics(); } catch { /* View still reports missing font through reason. */ }
  let sentences: { sentenceId: string; text: string; startMs: number; endMs: number }[] = [];
  try { sentences = captionSource(root, candidateId).timeline.segments.map(s => ({ sentenceId: s.segmentId, text: s.text, startMs: s.startMs, endMs: s.endMs })); } catch { /* Source reason is already in state. */ }
  return { ...state, approved: !!state.plan && captionApproved(state.plan), sentences, layoutPolicy: SHORTFORM_LAYOUT_POLICY,
    attention: state.plan ? Object.fromEntries(captionAttention(state.plan, state.issues)) : {},
    lines: state.plan && metrics ? Object.fromEntries(state.plan.cues.map(c => [c.cueId, wrapTextLines(metrics!, c.text, "caption")])) : {} };
}
/** Cues without explicit times get times from a verified alignment of their sentence (keeping the split); otherwise character-weighted estimates labeled `estimated`. */
function buildCues(timeline: AudioMasterTimeline, groups: Map<string, { ranges: Range[]; times: { startMs: number; endMs: number }[] | null; reviewed: boolean[] }>, previous: CaptionCue[], alignment: AlignmentJob | null) {
  const cues: CaptionCue[] = [];
  for (const segment of timeline.segments) {
    const group = groups.get(segment.segmentId); if (!group) throw new NarrationError("모든 문장에 자막 cue가 필요합니다.", 400);
    const aligned = group.times ? null : alignedCueTiming(segment, group.ranges, alignedFor(alignment, segment.segmentId));
    const derived = !group.times; const times = group.times ?? aligned?.times ?? estimateTimes(segment, group.ranges); const cps = [...segment.text];
    for (const [i, [sourceStart, sourceEnd]] of group.ranges.entries()) {
      const { startMs, endMs } = times[i]!; const same = previous.find(p => p.sentenceId === segment.segmentId && p.sourceStart === sourceStart && p.sourceEnd === sourceEnd);
      const unchanged = !!same && same.startMs === startMs && same.endMs === endMs; const source = aligned ? "forced_alignment" as const : "estimated" as const;
      cues.push({ cueId: same?.cueId ?? randomUUID(), sentenceId: segment.segmentId, ordinal: cues.length + 1, sourceStart, sourceEnd, text: slice(cps, [sourceStart, sourceEnd]), startMs, endMs,
        timingSource: derived ? source : unchanged ? same!.timingSource : "manual", reviewed: derived ? unchanged && same!.timingSource === source && same!.reviewed : group.reviewed[i]! });
    }
  }
  return cues;
}
export function mutateCaptionPlan(root: string, candidateId: string, mutation: CaptionMutation) {
  return withSceneLock(root, () => {
    const current = readCaptionPlan(root, candidateId);
    if ((current?.revision ?? null) !== mutation.expectedRevision || (current?.fingerprint ?? null) !== mutation.expectedFingerprint) throw new NarrationError("다른 화면에서 자막 cue가 변경되었습니다. 다시 불러와주세요.", 409);
    const source = captionSource(root, candidateId); const alignment = usableAlignment(root, candidateId);
    if (mutation.action === "approve") {
      if (!current || !sourceMatches(current, source)) throw new NarrationError("최신 Narration·음성 기준 자막 cue만 승인할 수 있습니다.", 409);
      if (planIssues(current, source, alignment).some(i => i.severity === "error")) throw new NarrationError("자막 cue 오류를 먼저 고쳐주세요.", 409);
      if (current.cues.some(c => !c.reviewed)) throw new NarrationError("모든 자막 cue를 검토 표시한 뒤 승인해주세요. 추정 시간도 사람이 확인해야 합니다.", 409);
      return writeApproval(root, current);
    }
    const groups = new Map<string, { ranges: Range[]; times: { startMs: number; endMs: number }[] | null; reviewed: boolean[] }>();
    if (mutation.action === "apply-alignment") {
      if (!current || !sourceMatches(current, source)) throw new NarrationError("최신 Narration·음성 기준 자막 cue에만 정렬 결과를 적용할 수 있습니다.", 409);
      if (!alignment) throw new NarrationError("현재 음성·문장에 맞는 완료된 정렬 결과가 없습니다. 정렬을 먼저 실행해주세요.", 409);
      // Keeps every split; a sentence with hand-entered times keeps them.
      for (const segment of source.timeline.segments) {
        const own = current.cues.filter(c => c.sentenceId === segment.segmentId); const manual = own.some(c => c.timingSource === "manual");
        groups.set(segment.segmentId, { ranges: own.map(c => [c.sourceStart, c.sourceEnd] as Range), times: manual ? own.map(c => ({ startMs: c.startMs, endMs: c.endMs })) : null, reviewed: own.map(c => c.reviewed) });
      }
    }
    // Only a layout-policy change (same audio, text and font) carries cues over: a sentence keeps its split, times and review only if every cue still fits.
    const carried = current && !sourceMatches(current, source) && sceneHash(current.lineage) === sceneHash(source.lineage) && current.fontFileSha256 === source.fontFileSha256 ? current.cues : [];
    const carriedErrors = carried.length ? validateCaptionCues(carried, source.timeline, source.metrics).filter(i => i.severity === "error") : [];
    if (mutation.action === "generate") for (const segment of source.timeline.segments) {
      const own = carried.filter(c => c.sentenceId === segment.segmentId);
      const keep = own.length > 0 && !carriedErrors.some(i => i.sentenceId === segment.segmentId);
      groups.set(segment.segmentId, keep ? { ranges: own.map(c => [c.sourceStart, c.sourceEnd] as Range), times: own.map(c => ({ startMs: c.startMs, endMs: c.endMs })), reviewed: own.map(c => c.reviewed) }
        : { ranges: proposeSentenceRanges(segment, source.metrics), times: null, reviewed: [] });
    }
    else if (mutation.action === "save") {
      for (const segment of source.timeline.segments) {
        const own = mutation.cues.filter(c => c.sentenceId === segment.segmentId); if (!own.length) continue;
        const explicit = own.every(c => c.startMs !== null && c.endMs !== null);
        groups.set(segment.segmentId, { ranges: rangesFromTexts(segment, own.map(c => c.text)), times: explicit ? own.map(c => ({ startMs: c.startMs!, endMs: c.endMs! })) : null, reviewed: own.map(c => c.reviewed) });
      }
      if (mutation.cues.some(c => !groups.has(c.sentenceId))) throw new NarrationError("현재 Narration에 없는 문장의 자막 cue입니다.", 400);
      const runs = mutation.cues.map(c => c.sentenceId).filter((id, i, all) => !i || all[i - 1] !== id);
      if (new Set(runs).size !== runs.length || runs.join() !== source.timeline.segments.map(s => s.segmentId).filter(id => runs.includes(id)).join()) throw new NarrationError("자막 cue는 Narration 문장 순서를 따라야 합니다.", 400);
    }
    const cues = buildCues(source.timeline, groups, current && sourceMatches(current, source) ? current.cues : carried, alignment);
    const alignmentRef = alignment && cues.some(c => c.timingSource === "forced_alignment")
      ? { jobId: alignment.jobId, audioTextFingerprint: alignment.audioTextFingerprint, resultFingerprint: alignment.result!.resultFingerprint } : undefined;
    const content = { contract: CAPTION_PLAN_CONTRACT, candidateId, lineage: source.lineage, layoutPolicyId: SHORTFORM_LAYOUT_POLICY.policyId, layoutPolicyFingerprint: source.layoutPolicyFingerprint,
      fontFileSha256: source.fontFileSha256, cues, ...(alignmentRef ? { alignment: alignmentRef } : {}) };
    if (current && mutation.action !== "generate" && captionFingerprint({ ...content, revision: current.revision }) === current.fingerprint) return current;
    const revision = (current?.revision ?? 0) + 1;
    const plan = captionPlanSchema.parse({ ...content, revision, fingerprint: captionFingerprint({ ...content, revision }), approval: null, updatedAt: new Date().toISOString() });
    atomicWriteFile(planPath(root), JSON.stringify(plan, null, 2), 0o600); return plan;
  });
}
function planIssues(plan: CaptionPlan, source: ReturnType<typeof captionSource>, alignment: AlignmentJob | null) {
  return [...validateCaptionCues(plan.cues, source.timeline, source.metrics), ...alignmentIssues(plan, source.timeline, alignment)];
}
function writeApproval(root: string, plan: CaptionPlan) {
  if (captionApproved(plan)) return plan;
  const approved = { ...plan, approval: { revision: plan.revision, fingerprint: plan.fingerprint, approvedAt: new Date().toISOString() } };
  atomicWriteFile(planPath(root), JSON.stringify(captionPlanSchema.parse(approved), null, 2), 0o600); return approved;
}
/**
 * Marks every cue reviewed and approves in one step, only after a completed preview rendered from exactly this plan
 * (`verifyPreview` throws otherwise) and with every cue needing attention acknowledged by ID. Errors still block.
 */
export function bulkApproveCaptionPlan(root: string, candidateId: string, input: CaptionBulkApproval, verifyPreview: (plan: CaptionPlan) => void) {
  return withSceneLock(root, () => {
    const current = readCaptionPlan(root, candidateId);
    if (!current || current.revision !== input.expectedRevision || current.fingerprint !== input.expectedFingerprint) throw new NarrationError("다른 화면에서 자막 cue가 변경되었습니다. 다시 불러와주세요.", 409);
    const source = captionSource(root, candidateId);
    if (!sourceMatches(current, source)) throw new NarrationError("최신 Narration·음성 기준 자막 cue만 승인할 수 있습니다.", 409);
    const issues = planIssues(current, source, usableAlignment(root, candidateId));
    if (issues.some(i => i.severity === "error")) throw new NarrationError("자막 cue 오류를 먼저 고쳐주세요.", 409);
    verifyPreview(current);
    const missing = [...captionAttention(current, issues).keys()].filter(id => !input.acknowledgedCueIds.includes(id));
    if (missing.length) throw new NarrationError(`확인이 필요한 cue ${missing.length}개를 먼저 확인 표시해주세요.`, 409);
    if (current.cues.every(c => c.reviewed)) return writeApproval(root, current);
    const cues = current.cues.map(c => ({ ...c, reviewed: true })); const revision = current.revision + 1;
    const content = { ...current, cues, revision }; const fingerprint = captionFingerprint(content);
    const plan = captionPlanSchema.parse({ ...content, fingerprint, approval: { revision, fingerprint, approvedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() });
    atomicWriteFile(planPath(root), JSON.stringify(plan, null, 2), 0o600); return plan;
  });
}
