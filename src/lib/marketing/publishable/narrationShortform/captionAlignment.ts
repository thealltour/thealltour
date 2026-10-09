import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { NarrationError } from "../narration/persistence";
import { latestNarrationAudioJob, processedAudioFingerprint, readNarrationAudioJob } from "../narration/audio";
import { loadSceneSource, sceneHash, withSceneLock } from "../narrationScenes/service";
import { motionQueueDirectory, motionWorkerAvailable } from "../narrationMotion/service";
import { ALIGNMENT_NORMALIZER_VERSION, ALIGNMENT_WILDCARD, alignmentTextFingerprint, alignmentUnits } from "./alignmentText";

type Segment = AudioMasterTimeline["segments"][number];
const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** Apache-2.0 Korean CTC model chosen after the local fixture comparison (docs/marketing/narration-caption-alignment.md). */
export const ALIGNMENT_MODEL = { id: "w11wo/wav2vec2-xls-r-300m-korean@eee56866fdf44037553ec973fd859f7f5f8ec483", sha256: "5053bf2b841730db3418c7192453d10ccc89bd0225eb853dfa85b171f67fbd33", license: "apache-2.0" } as const;
/**
 * The model reports no confidence. These limits apply to measured quantities only and were set from the local fixtures:
 * correct text gave speech ratio ≥0.08, per-unit CER ≤0.08 and forced−free log-probability ≥−0.23/frame; wrong text, missing speech
 * and silence gave CER ≥0.71 or gap ≤−1.47 or ratio 0.02. CTC often puts two adjacent syllables one frame apart in correct speech (at most 2 such gaps
 * in a row on the fixtures); 4+ in a row (5 syllables in 80ms) only appeared when text was squeezed into audio that lacks it (missing speech: 22).
 */
export const ALIGNMENT_CHECKS = { minSpeechFrameRatio: 0.03, maxUnitCer: 0.35, minLogProbGapPerFrame: -1.0, maxOneFrameOnsetRun: 3 } as const;
export const alignmentConfigSchema = z.object({ version: z.literal("ctc-lattice-v1"), frameMs: z.literal(20), threads: z.literal(4), starPenalty: z.literal(1), runnerSha256: hash,
  modelId: z.literal(ALIGNMENT_MODEL.id), modelSha256: z.literal(ALIGNMENT_MODEL.sha256), normalizer: z.literal(ALIGNMENT_NORMALIZER_VERSION) }).strict();
export const alignmentRunnerPath = () => join(process.cwd(), "scripts/mini-pc/narration-align/runner.py");
export function alignmentConfig(): z.infer<typeof alignmentConfigSchema> {
  return { version: "ctc-lattice-v1", frameMs: 20, threads: 4, starPenalty: 1, runnerSha256: sha256FileSync(alignmentRunnerPath()), modelId: ALIGNMENT_MODEL.id, modelSha256: ALIGNMENT_MODEL.sha256, normalizer: ALIGNMENT_NORMALIZER_VERSION };
}
const unitSchema = z.object({ cpStart: z.number().int().nonnegative(), cpEnd: z.number().int().positive(), kind: z.enum(["hangul", "number", "latin", "symbol"]), readings: z.array(z.string().max(120)).min(1).max(64) }).strict();
const alignedUnitSchema = z.object({ cpStart: z.number().int().nonnegative(), cpEnd: z.number().int().positive(), reading: z.string().nullable(), wildcard: z.boolean(),
  startMs: z.number().int().nonnegative().nullable(), endMs: z.number().int().positive().nullable(), onsetsMs: z.array(z.number().int().nonnegative()).max(200), heard: z.string().max(400) }).strict();
const sentenceResultSchema = z.object({ sentenceId: z.string().uuid(), status: z.enum(["verified", "review_required", "failed"]), reasons: z.array(z.string().max(80)).max(10),
  units: z.array(alignedUnitSchema).max(400), greedy: z.string().max(2000), elapsedMs: z.number().int().nonnegative(),
  measures: z.object({ frames: z.number().int().nonnegative(), speechFrameRatio: z.number().nullable(), forcedLogProbPerFrame: z.number().nullable(), freeLogProbPerFrame: z.number().nullable(), unitCer: z.number().nullable() }).strict() }).strict();
export type AlignmentSentenceResult = z.infer<typeof sentenceResultSchema>;
const inputSentenceSchema = z.object({ sentenceId: z.string().uuid(), audioRelativePath: z.string().min(1), audioSha256: hash, durationMs: z.number().int().positive(), text: z.string().min(1),
  textFingerprint: hash, units: z.array(unitSchema).max(400) }).strict();
export const alignmentJobSchema = z.object({ contract: z.literal("narration-caption-alignment-job-v1"), jobId: z.string().uuid(), candidateId: z.string().min(1), audioJobId: z.string().uuid(),
  processedAudioFingerprint: hash.nullable(), config: alignmentConfigSchema, sentences: z.array(inputSentenceSchema).min(1).max(16), inputFingerprint: hash, audioTextFingerprint: hash,
  attempt: z.number().int().positive(), createdAt: z.string().datetime(), startedAt: z.string().datetime().nullable(), heartbeatAt: z.string().datetime().nullable(), completedAt: z.string().datetime().nullable(),
  status: z.enum(["queued", "running", "completed", "failed", "stale"]), errorCode: z.string().max(80).nullable(),
  result: z.object({ resultFingerprint: hash, runner: z.object({ torchVersion: z.string(), transformersVersion: z.string(), numpyVersion: z.string(), device: z.literal("cpu"), threads: z.number().int(), modelLoadMs: z.number().int(), elapsedMs: z.number().int() }).strict(),
    sentences: z.array(sentenceResultSchema).max(16) }).strict().nullable() }).strict();
export type AlignmentJob = z.infer<typeof alignmentJobSchema>;
type AlignmentInputs = Pick<AlignmentJob, "candidateId" | "audioJobId" | "processedAudioFingerprint" | "config" | "sentences">;

const directory = (root: string) => join(root, "context/narration/caption-alignment");
const jobPath = (root: string, jobId: string) => { if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("정렬 작업 ID가 올바르지 않습니다.", 400); return join(directory(root), "jobs", `${jobId}.json`); };
const currentPath = (root: string) => join(directory(root), "current.json");
/** Audio bytes + approved text only: what an alignment result is a function of, independent of runner/config versions. */
export const alignmentAudioTextFingerprint = (sentences: AlignmentInputs["sentences"]) => sceneHash(sentences.map(s => ({ sentenceId: s.sentenceId, audioSha256: s.audioSha256, textFingerprint: s.textFingerprint })));
export const alignmentInputFingerprint = ({ candidateId, audioJobId, processedAudioFingerprint, config, sentences }: AlignmentInputs) =>
  sceneHash({ contract: "narration-caption-alignment-input-v1", candidateId, audioJobId, processedAudioFingerprint, config, sentences });

/** Input = the final processed WAVs on the current timeline (never raw TTS) and the approved sentence text; sentences are never rewritten or re-split. */
export function alignmentInputs(root: string, candidateId: string): AlignmentInputs {
  const latest = latestNarrationAudioJob(root, candidateId); if (!latest) throw new NarrationError("현재 Narration의 음성 작업이 필요합니다.");
  const scene = loadSceneSource(root, candidateId, latest.jobId); const audio = readNarrationAudioJob(root, latest.jobId);
  return { candidateId, audioJobId: latest.jobId, processedAudioFingerprint: processedAudioFingerprint(audio), config: alignmentConfig(),
    sentences: scene.timeline.segments.map(s => { const units = alignmentUnits(s.text); return { sentenceId: s.segmentId, audioRelativePath: s.relativeAudioPath, audioSha256: s.audioSha256, durationMs: s.durationMs,
      text: s.text, textFingerprint: alignmentTextFingerprint(s.text, units), units }; }) };
}
export function readAlignmentJob(root: string, jobId: string): AlignmentJob {
  const path = jobPath(root, jobId); if (!existsSync(path)) throw new NarrationError("정렬 작업을 찾을 수 없습니다.", 404);
  const job = alignmentJobSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (job.jobId !== jobId || job.inputFingerprint !== alignmentInputFingerprint(job) || job.audioTextFingerprint !== alignmentAudioTextFingerprint(job.sentences) ||
    (job.status === "completed") !== !!job.result || (job.result && job.result.resultFingerprint !== sceneHash(job.result.sentences))) throw new NarrationError("정렬 작업 연결 정보가 다릅니다.", 409);
  return job;
}
export function currentAlignmentJob(root: string): AlignmentJob | null {
  if (!existsSync(currentPath(root))) return null;
  try { return readAlignmentJob(root, (JSON.parse(readFileSync(currentPath(root), "utf8")) as { jobId: string }).jobId); } catch { return null; }
}
const save = (root: string, job: AlignmentJob) => atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(alignmentJobSchema.parse(job), null, 2), 0o600);
export function alignmentJobFresh(root: string, job: AlignmentJob) {
  try { return alignmentInputFingerprint(alignmentInputs(root, job.candidateId)) === job.inputFingerprint; } catch { return false; }
}
/** A completed result stays usable for captions while the same audio bytes and text are current, even after a runner/config update. */
export function usableAlignment(root: string, candidateId: string) {
  const job = currentAlignmentJob(root); if (!job || job.candidateId !== candidateId || job.status !== "completed" || !job.result) return null;
  try { return alignmentAudioTextFingerprint(alignmentInputs(root, candidateId).sentences) === job.audioTextFingerprint ? job : null; } catch { return null; }
}
const publish = (root: string, job: AlignmentJob) => atomicWriteFile(join(motionQueueDirectory(), `${job.jobId}.json`), JSON.stringify({ kind: "caption-align-v1", root, jobId: job.jobId, createdAt: job.createdAt, order: 0 }), 0o600);
/** Same input while queued/running/completed returns the existing job; only failed or stale inputs get a new attempt. */
export function queueCaptionAlignment(root: string, candidateId: string, expectedInputFingerprint: string | null) {
  if (!motionWorkerAvailable()) throw new NarrationError("영상 실행기가 연결되지 않았습니다. 정렬 작업을 맡길 수 없습니다.", 503);
  return withSceneLock(root, () => {
    const inputs = alignmentInputs(root, candidateId); const inputFingerprint = alignmentInputFingerprint(inputs);
    if (expectedInputFingerprint && expectedInputFingerprint !== inputFingerprint) throw new NarrationError("음성 또는 문장이 바뀌었습니다. 다시 불러와주세요.", 409);
    const previous = currentAlignmentJob(root);
    if (previous && previous.inputFingerprint === inputFingerprint && ["queued", "running", "completed"].includes(previous.status)) { if (previous.status === "queued") publish(root, previous); return previous; }
    const job: AlignmentJob = { contract: "narration-caption-alignment-job-v1", jobId: randomUUID(), ...inputs, inputFingerprint, audioTextFingerprint: alignmentAudioTextFingerprint(inputs.sentences),
      attempt: previous && previous.inputFingerprint === inputFingerprint ? previous.attempt + 1 : 1, createdAt: new Date().toISOString(), startedAt: null, heartbeatAt: null, completedAt: null,
      status: "queued", errorCode: null, result: null };
    save(root, job); atomicWriteFile(currentPath(root), JSON.stringify({ jobId: job.jobId }), 0o600); publish(root, job); return job;
  });
}

/** Remote command is fixed server configuration; the payload goes over stdin. */
export function executeMiniAlign(payload: string): Promise<string> {
  const host = process.env.NARRATION_ALIGN_SSH_HOST || process.env.NARRATION_MOTION_SSH_HOST || "thealltour-ai";
  const python = process.env.NARRATION_ALIGN_PYTHON || "/home/ysh/experiments/thealltour-narration-align/venv/bin/python";
  const runner = process.env.NARRATION_ALIGN_RUNNER || "/home/ysh/experiments/thealltour-narration-align/runner.py";
  if (!/^[a-zA-Z0-9_.@-]+$/.test(host) || ![python, runner].every(p => /^\/[a-zA-Z0-9_/.-]+$/.test(p) && !p.includes(".."))) throw new NarrationError("정렬 실행 설정을 확인해주세요.", 503);
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3", host, python, runner], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = []; let size = 0; let finished = false; let errorTail = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); done(new Error("remote_timeout")); }, 10 * 60_000);
    function done(error?: Error) { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else resolve(Buffer.concat(chunks).toString("utf8")); }
    child.stdout.on("data", (b: Buffer) => { size += b.length; if (size > 8 * 1024 * 1024) { child.kill(); done(new Error("remote_output_too_large")); } else chunks.push(b); });
    child.stderr.on("data", (b: Buffer) => { errorTail = (errorTail + b.toString("utf8")).slice(-4096); });
    child.on("error", error => done(error)); child.stdin.on("error", error => done(error));
    child.on("close", code => done(code === 0 ? undefined : new Error(/model_(hash_mismatch|not_pinned)|runner_mismatch|audio_hash_mismatch/.exec(errorTail)?.[0] ?? "remote_runner_failed")));
    child.stdin.end(payload);
  });
}
const runnerUnitSchema = z.object({ index: z.number().int().nonnegative(), reading: z.number().int().nonnegative().nullable(), spoken: z.boolean(), startMs: z.number().nullable(), endMs: z.number().nullable(),
  labelFrames: z.number().int().nonnegative(), onsetsMs: z.array(z.number()).max(400), heard: z.string().max(400) }).strict();
const runnerSentenceSchema = z.object({ sentenceId: z.string().uuid(), audioSha256: hash, sampleRate: z.number().int().positive(), sampleCount: z.number().int().positive(), frameMs: z.literal(20),
  status: z.enum(["aligned", "failed"]), error: z.string().max(80).optional(), frames: z.number().int().nonnegative().optional(), greedy: z.string().max(2000).optional(), speechFrameRatio: z.number().optional(),
  freeLogProbPerFrame: z.number().optional(), forcedLogProbPerFrame: z.number().optional(), units: z.array(runnerUnitSchema).max(400).optional(), oovSyllables: z.array(z.string()).max(400).optional(), elapsedMs: z.number().int().nonnegative() }).strict();
export const runnerResponseSchema = z.object({ contract: z.literal("narration-caption-align-output-v1"), jobId: z.string().uuid(), inputFingerprint: hash, runnerSha256: hash, modelId: z.string(), modelSha256: hash,
  torchVersion: z.string().max(40), transformersVersion: z.string().max(40), numpyVersion: z.string().max(40), device: z.literal("cpu"), threads: z.number().int(), modelLoadMs: z.number().int(), elapsedMs: z.number().int(),
  sentences: z.array(runnerSentenceSchema).max(16) }).strict();
export type RunnerSentence = z.infer<typeof runnerSentenceSchema>;

function editDistance(a: string[], b: string[]) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const row = [i]; for (let j = 1; j <= b.length; j++) row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = row; }
  return previous[b.length]!;
}
/** Turns raw runner output into a verified / review_required / failed sentence result. Only measured values are stored; no confidence is synthesized. */
export function evaluateAlignedSentence(input: z.infer<typeof inputSentenceSchema>, raw: RunnerSentence): AlignmentSentenceResult {
  const measures = { frames: raw.frames ?? 0, speechFrameRatio: raw.speechFrameRatio ?? null, forcedLogProbPerFrame: raw.forcedLogProbPerFrame ?? null, freeLogProbPerFrame: raw.freeLogProbPerFrame ?? null, unitCer: null as number | null };
  const base = { sentenceId: input.sentenceId, greedy: raw.greedy ?? "", elapsedMs: raw.elapsedMs, measures };
  const fail = (reason: string): AlignmentSentenceResult => ({ ...base, status: "failed", reasons: [reason], units: [] });
  if (raw.sentenceId !== input.sentenceId || raw.audioSha256 !== input.audioSha256) return fail("identity_mismatch");
  if (raw.status === "failed") return fail(raw.error ?? "runner_failed");
  if ((raw.speechFrameRatio ?? 0) < ALIGNMENT_CHECKS.minSpeechFrameRatio) return fail("no_speech");
  const units = raw.units ?? []; if (units.length !== input.units.length) return fail("unit_count_mismatch");
  const limitMs = Math.ceil(input.durationMs / 20) * 20 + 20; let previousStart = -1; let edits = 0; let total = 0; const reasons = new Set<string>(); let lastOnset: number | null = null; let run = 0;
  const aligned: AlignmentSentenceResult["units"] = [];
  for (const [i, unit] of units.entries()) {
    const source = input.units[i]!; if (unit.index !== i) return fail("unit_order_mismatch");
    const reading = unit.reading === null ? null : source.readings[unit.reading]; if (unit.reading !== null && reading === undefined) return fail("reading_index_invalid");
    if (!unit.spoken) {
      if (reading !== "") return fail("unit_missing");
      aligned.push({ cpStart: source.cpStart, cpEnd: source.cpEnd, reading: "", wildcard: false, startMs: null, endMs: null, onsetsMs: [], heard: "" }); continue;
    }
    if (reading === null || reading === undefined || unit.startMs === null || unit.endMs === null) return fail("unit_missing");
    if (!(unit.startMs < unit.endMs) || unit.startMs < previousStart || unit.endMs > limitMs || unit.onsetsMs.some((v, k) => k > 0 && v <= unit.onsetsMs[k - 1]!)) return fail("timestamp_order");
    previousStart = unit.startMs;
    const wildcard = reading.includes(ALIGNMENT_WILDCARD);
    if (!wildcard) { const ref = [...reading.replace(/\s/g, "")]; edits += editDistance(ref, [...unit.heard.replace(/\s/g, "")]); total += ref.length;
      for (const onset of unit.onsetsMs) {
        run = lastOnset !== null && onset - lastOnset <= 20 ? run + 1 : 0; if (run > ALIGNMENT_CHECKS.maxOneFrameOnsetRun) reasons.add("compressed_speech"); lastOnset = onset;
      } }
    else { lastOnset = null; run = 0; }
    aligned.push({ cpStart: source.cpStart, cpEnd: source.cpEnd, reading, wildcard, startMs: Math.round(unit.startMs), endMs: Math.round(Math.min(unit.endMs, input.durationMs)), onsetsMs: unit.onsetsMs.map(Math.round), heard: unit.heard });
  }
  measures.unitCer = total ? Math.round(edits / total * 1000) / 1000 : null;
  if (measures.unitCer !== null && measures.unitCer > ALIGNMENT_CHECKS.maxUnitCer) reasons.add("text_audio_mismatch");
  if (measures.forcedLogProbPerFrame !== null && measures.freeLogProbPerFrame !== null && measures.forcedLogProbPerFrame - measures.freeLogProbPerFrame < ALIGNMENT_CHECKS.minLogProbGapPerFrame) reasons.add("low_alignment_likelihood");
  if (!aligned.some(u => u.startMs !== null && !u.wildcard)) reasons.add("mostly_wildcard");
  return { ...base, status: reasons.size ? "review_required" : "verified", reasons: [...reasons].sort(), units: aligned };
}

export async function runCaptionAlignment(root: string, jobId: string, execute: (payload: string) => Promise<string> = executeMiniAlign) {
  let job = readAlignmentJob(root, jobId); if (!["queued", "running"].includes(job.status)) return job;
  if (!alignmentJobFresh(root, job)) { job = { ...job, status: "stale" }; save(root, job); return job; }
  job = { ...job, status: "running", startedAt: job.startedAt ?? new Date().toISOString(), heartbeatAt: new Date().toISOString(), errorCode: null }; save(root, job);
  const heartbeat = setInterval(() => { job = { ...job, heartbeatAt: new Date().toISOString() }; save(root, job); }, 10_000);
  try {
    const sentences = job.sentences.map(s => { const audio = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: s.audioRelativePath }));
      if (sha256Buffer(audio) !== s.audioSha256) throw new Error("audio_changed"); return { sentenceId: s.sentenceId, audioSha256: s.audioSha256, audioBase64: audio.toString("base64"), units: s.units }; });
    const request = JSON.stringify({ contract: "narration-caption-align-input-v1", jobId, inputFingerprint: job.inputFingerprint, config: job.config, sentences });
    let raw = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try { raw = await execute(request); break; }
      catch (error) { if (attempt === 1 || !alignmentJobFresh(root, job) || (error instanceof Error && /mismatch|not_pinned/.test(error.message))) throw error; }
    }
    const response = runnerResponseSchema.parse(JSON.parse(raw));
    if (response.jobId !== jobId || response.inputFingerprint !== job.inputFingerprint || response.runnerSha256 !== job.config.runnerSha256 || response.modelId !== job.config.modelId ||
      response.modelSha256 !== job.config.modelSha256 || response.sentences.length !== job.sentences.length) throw new Error("remote_identity_mismatch");
    const results = job.sentences.map((s, i) => evaluateAlignedSentence(s, response.sentences[i]!));
    if (!alignmentJobFresh(root, job)) { job = { ...job, status: "stale" }; return job; }
    job = { ...job, status: "completed", completedAt: new Date().toISOString(), result: { resultFingerprint: sceneHash(results), runner: { torchVersion: response.torchVersion, transformersVersion: response.transformersVersion,
      numpyVersion: response.numpyVersion, device: response.device, threads: response.threads, modelLoadMs: response.modelLoadMs, elapsedMs: response.elapsedMs }, sentences: results } };
    return job;
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]{3,60}$/.test(error.message) ? error.message : "alignment_failed";
    job = { ...job, status: alignmentJobFresh(root, job) ? "failed" : "stale", errorCode: code, result: null }; return job;
  } finally { clearInterval(heartbeat); save(root, job); }
}

export type AlignedCueTiming = { times: { startMs: number; endMs: number }[]; flags: string[][] };
/**
 * Cue times from a verified sentence alignment, keeping the existing cue split. CTC label onsets were accurate on the fixtures (0–60ms)
 * while label ends ran 100–270ms early, so only onsets are used: the first cue starts at the sentence start, each later cue at its first spoken
 * unit's onset, and every cue ends where the next begins (the last at the sentence end). Returns null when the split cannot be timed from the units.
 */
export function alignedCueTiming(segment: Segment, ranges: [number, number][], result: AlignmentSentenceResult | null): AlignedCueTiming | null {
  if (!result || result.status !== "verified") return null;
  const onsets: number[] = []; const flags: string[][] = [];
  for (const [i, [start, end]] of ranges.entries()) {
    const own = result.units.filter(u => u.startMs !== null && u.cpStart >= start && u.cpEnd <= end); const cueFlags: string[] = [];
    if (result.units.some(u => u.cpStart < end && u.cpEnd > end && u.cpStart >= start)) return null;
    if (!own.length) return null;
    if (i > 0 && own[0]!.wildcard) cueFlags.push("boundary_wildcard");
    if (own.every(u => u.wildcard)) cueFlags.push("wildcard_only");
    onsets.push(own[0]!.startMs!); flags.push(cueFlags);
  }
  const starts = onsets.map((onset, i) => i ? segment.startMs + onset : segment.startMs);
  if (starts.some((s, i) => i > 0 && s <= starts[i - 1]!) || starts.at(-1)! >= segment.endMs) return null;
  return { times: starts.map((startMs, i) => ({ startMs, endMs: starts[i + 1] ?? segment.endMs })), flags };
}
export const alignmentReasonLabels: Record<string, string> = {
  no_speech: "음성에서 말소리를 찾지 못했습니다", text_audio_mismatch: "들린 내용이 승인 문장과 많이 다릅니다", low_alignment_likelihood: "음성과 문장이 잘 맞지 않습니다",
  compressed_speech: "일부 글자가 너무 짧은 구간에 몰렸습니다(발화 누락 가능)", mostly_wildcard: "읽기를 확인할 수 있는 한글이 거의 없습니다", unit_missing: "정렬되지 않은 단어가 있습니다",
  timestamp_order: "시간 순서가 맞지 않습니다", identity_mismatch: "음성 파일이 다릅니다", unit_count_mismatch: "정렬 결과 형식이 다릅니다", audio_too_short: "음성이 너무 짧습니다",
  no_alignment_path: "정렬 경로를 찾지 못했습니다", boundary_wildcard: "cue 시작이 영문·숫자처럼 읽기를 확인할 수 없는 단어입니다", wildcard_only: "읽기를 확인할 수 없는 단어로만 된 cue입니다",
};
/** Read-only summary for the review screen. `fresh` false means audio or text changed after this job was created. */
export function alignmentView(root: string, candidateId: string) {
  const job = currentAlignmentJob(root); let current: string | null = null;
  try { current = alignmentInputFingerprint(alignmentInputs(root, candidateId)); } catch { current = null; }
  if (!job || job.candidateId !== candidateId) return { job: null, currentInputFingerprint: current };
  const heartbeatAgeMs = job.heartbeatAt ? Date.now() - Date.parse(job.heartbeatAt) : null;
  return { currentInputFingerprint: current, job: { jobId: job.jobId, status: job.status, errorCode: job.errorCode, attempt: job.attempt, createdAt: job.createdAt, startedAt: job.startedAt,
    completedAt: job.completedAt, heartbeatAgeMs, fresh: job.inputFingerprint === current, inputFingerprint: job.inputFingerprint, audioTextFingerprint: job.audioTextFingerprint, config: job.config,
    runner: job.result?.runner ?? null, resultFingerprint: job.result?.resultFingerprint ?? null,
    sentences: job.result?.sentences.map(s => ({ sentenceId: s.sentenceId, status: s.status, reasons: s.reasons, measures: s.measures, greedy: s.greedy, elapsedMs: s.elapsedMs,
      units: s.units.map(u => ({ cpStart: u.cpStart, cpEnd: u.cpEnd, reading: u.reading, wildcard: u.wildcard, startMs: u.startMs, heard: u.heard })) })) ?? [] } };
}
