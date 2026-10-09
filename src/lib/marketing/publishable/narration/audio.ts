import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { ttsProfileSchema, type TtsProfile } from "@/lib/marketing/tts/contracts";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import type { AudioDurationProbe } from "@/lib/marketing/tts/duration/probe";
import { generateNarrationMasterTimeline, type NarrationSegmentAudioProcessor } from "@/lib/marketing/tts/timeline/orchestrate";
import { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
import { audioProcessingSidecarSchema, currentEdgeTrimPolicy, edgeDecisionSchema, edgeTrimPolicyFingerprint, edgeTrimPolicySchema, policyAnalysisParameters, type EdgeDecision, type EdgeTrimPolicy } from "@/lib/marketing/tts/audioProcessing/contracts";
import { processNarrationSegmentAudio, processNarrationSegmentRange, processedSegmentPaths } from "@/lib/marketing/tts/audioProcessing/persist";
import { analyzeEdges, parsePcmWav, rangeTrimDiagnostics, wavePeaks } from "@/lib/marketing/tts/audioProcessing/trimEdges";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import { audioMasterTimelineSchema } from "@/lib/marketing/tts/timeline/contracts";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
import { narrationSchema, type NarrationLineage } from "./contracts";
import { contentFingerprint, narrationGate, NarrationError, readNarration } from "./persistence";
import { stableFingerprint } from "./fingerprint";
import { resolveVoiceStudioEnv } from "@/lib/marketing/tts/voiceStudio/config";

const sha = stableFingerprint;
const jobV1Schema = z.object({
  contract: z.literal("narration-audio-job-v1"), jobId: z.string().uuid(),
  narration: narrationSchema, profile: ttsProfileSchema, configFingerprint: z.string().length(64),
  endpointIdentity: z.string().min(1), createdAt: z.string().datetime(),
  status: z.enum(["queued", "running", "completed", "failed", "stale"]),
  errorCode: z.string().nullable(), timeline: audioMasterTimelineSchema.nullable(),
  speed: z.number().min(0.7).max(2).optional(),
}).strict();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const processingSegmentSchema = z.object({ segmentId: z.string().uuid(), sidecarRelativePath: z.string(), sidecarSha256: hash, rawAudioJobId: z.string().uuid(), rawRelativePath: z.string(), rawSha256: hash,
  processedSha256: hash.nullable(), status: z.enum(["ready", "review_required", "failed"]), removedLeadingMs: z.number().int().nonnegative(), removedTrailingMs: z.number().int().nonnegative(),
  rawDurationMs: z.number().int().nonnegative().nullable(), measuredDurationMs: z.number().int().positive().nullable(), diagnostics: z.array(z.string()).max(20), edgeDecision: edgeDecisionSchema.optional() }).strict();
/** v2: timeline segments point at edge-trimmed WAVs; raw WAVs and receipts stay at their original immutable paths. `policy` is the immutable snapshot the job ran with. */
const jobV2Schema = jobV1Schema.extend({ contract: z.literal("narration-audio-job-v2"), processing: z.object({ policy: edgeTrimPolicySchema, policyId: edgeTrimPolicySchema.shape.policyId, policyFingerprint: hash,
  sourceAudioJobId: z.string().uuid().nullable(), segments: z.array(processingSegmentSchema).max(16) }).strict() }).strict();
const jobSchema = z.discriminatedUnion("contract", [jobV1Schema, jobV2Schema]);
export type NarrationAudioJob = z.infer<typeof jobSchema>;
export type ProcessedNarrationAudioJob = Extract<NarrationAudioJob, { contract: "narration-audio-job-v2" }>;
type ProcessingSegment = z.infer<typeof processingSegmentSchema>;
const storedProcessingPolicy = (job: NarrationAudioJob) => job.contract === "narration-audio-job-v2" ? job.processing.policyFingerprint : undefined;
const processingSnapshot = (policy: EdgeTrimPolicy) => ({ policy, policyId: policy.policyId, policyFingerprint: edgeTrimPolicyFingerprint(policy) });
/** Freshness compares the job's recorded policy snapshot, not the current default; a default change alone never stales existing jobs. */
export function currentAudioConfigFingerprint(job: NarrationAudioJob, endpointIdentity: string) {
  return audioConfigFingerprint(narrationAudioProfileForJob(job), endpointIdentity, storedProcessingPolicy(job));
}
/** True when the current default differs from what the job recorded; only an explicit reprocess (a new job) applies it. */
export function processingPolicyOutdated(job: NarrationAudioJob) {
  return job.contract === "narration-audio-job-v1" || job.processing.policyFingerprint !== edgeTrimPolicyFingerprint(currentEdgeTrimPolicy());
}
export function configuredNarrationAudioProfiles(): TtsProfile[] {
  const raw = resolveVoiceStudioEnv().NARRATION_TTS_PROFILE_JSON?.trim();
  if (!raw) return [];
  const decoded: unknown = JSON.parse(raw);
  const profiles = z.array(ttsProfileSchema).parse(Array.isArray(decoded) ? decoded : [decoded]);
  if (new Set(profiles.map(p => p.profileId)).size !== profiles.length) throw new NarrationError("음성 프로필 ID가 중복됩니다.");
  return profiles.filter(profile => profile.enabled);
}
export function resolveNarrationAudioProfile(profileId: string): TtsProfile {
  const profile = configuredNarrationAudioProfiles().find(p => p.profileId === profileId);
  if (profile) return profile;
  // Legacy development profiles are available only by their explicit IDs.
  return resolveTtsProfile(profileId);
}
export function narrationAudioProfileForJob(job: NarrationAudioJob): TtsProfile {
  const profile = resolveNarrationAudioProfile(job.profile.profileId);
  return job.speed === undefined ? profile : { ...profile, speed: job.speed };
}
export function latestNarrationAudioJob(root: string, candidateId: string): NarrationAudioJob | null {
  const directory = join(root, "context/narration/audio-jobs");
  if (!existsSync(directory)) return null;
  const jobs = readdirSync(directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name))
    .map(name => jobSchema.parse(JSON.parse(readFileSync(join(directory, name), "utf8"))))
    .filter(job => job.narration.candidateId === candidateId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return jobs[0] ? readNarrationAudioJob(root, jobs[0].jobId) : null;
}
export function failNarrationAudioJob(root: string, jobId: string, errorCode: string) {
  const job = readNarrationAudioJob(root, jobId);
  if (job.status !== "queued" && job.status !== "running") return;
  job.status = "failed"; job.errorCode = errorCode;
  atomicWriteFile(jobPath(root, jobId), JSON.stringify(job, null, 2));
}
export function audioConfigFingerprint(profile: TtsProfile, endpointIdentity: string, processingPolicyFingerprint?: string) {
  const endpoint = new URL(endpointIdentity);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new NarrationError("TTS 주소에 인증 정보나 query를 포함할 수 없습니다.", 400);
  return sha({ profile, endpointIdentity, algorithm: "sentence-wav-ffprobe-v1", pauseMs: 250, trailingPauseMs: 0, ...(processingPolicyFingerprint ? { processingPolicyFingerprint } : {}) });
}
function jobPath(root: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("음성 작업 ID가 올바르지 않습니다.", 400);
  return join(root, "context/narration/audio-jobs", `${jobId}.json`);
}
export function readNarrationAudioJob(root: string, jobId: string): NarrationAudioJob {
  const path = jobPath(root, jobId);
  if (!existsSync(path)) throw new NarrationError("음성 작업을 찾을 수 없습니다.", 404);
  const job = jobSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (job.jobId !== jobId || (job.speed !== undefined && job.profile.speed !== job.speed) || job.configFingerprint !== audioConfigFingerprint(job.profile, job.endpointIdentity, storedProcessingPolicy(job)) ||
    job.narration.fingerprint !== contentFingerprint(job.narration) ||
    !job.narration.approval || job.narration.approval.revision !== job.narration.revision || job.narration.approval.fingerprint !== job.narration.fingerprint ||
    job.narration.sentences.some((s, index) => s.order !== index) ||
    new Set(job.narration.sentences.map(s => s.sentenceId)).size !== job.narration.sentences.length ||
    (job.contract === "narration-audio-job-v2" && (job.processing.policyFingerprint !== edgeTrimPolicyFingerprint(job.processing.policy) || job.processing.policyId !== job.processing.policy.policyId))) throw new NarrationError("음성 작업 연결 정보가 일치하지 않습니다.", 500);
  if (job.status === "completed" && !job.timeline) throw new NarrationError("음성 작업의 타임라인이 없습니다.", 500);
  if (job.timeline) {
    let cursor = 0;
    if (job.timeline.candidateId !== job.narration.candidateId || job.timeline.profileId !== job.profile.profileId || job.timeline.segments.length !== job.narration.sentences.length) throw new NarrationError("타임라인 연결 정보가 일치하지 않습니다.", 500);
    for (const [index, segment] of job.timeline.segments.entries()) {
      const sentence = job.narration.sentences[index]!;
      if (index) cursor += 250;
      if (segment.segmentId !== sentence.sentenceId || segment.ordinal !== index + 1 || segment.text !== normalizeNarrationForTts(sentence.text) || segment.startMs !== cursor || segment.endMs !== cursor + segment.durationMs) throw new NarrationError("문장별 타임라인이 일치하지 않습니다.", 500);
      cursor = segment.endMs;
      const audio = resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.relativeAudioPath });
      const expectedPrefix = `reel/narration/v${job.narration.revision}/${job.configFingerprint}/${job.jobId}/`;
      if (!segment.relativeAudioPath.startsWith(expectedPrefix) || !segment.relativeGenerationPath.startsWith(expectedPrefix) || !existsSync(audio) || createHash("sha256").update(readFileSync(audio)).digest("hex") !== segment.audioSha256) throw new NarrationError("음성 파일이 없거나 변경되었습니다.", 409);
    }
    if (job.timeline.totalDurationMs !== cursor) throw new NarrationError("타임라인 전체 길이가 일치하지 않습니다.", 500);
    if (job.contract === "narration-audio-job-v2") assertProcessedSegments(root, job);
  }
  return job;
}
function assertProcessedSegments(root: string, job: ProcessedNarrationAudioJob) {
  const fail = () => new NarrationError("무음 정리 음성 연결 정보가 다르거나 원본 음성이 변경되었습니다.", 409);
  if (job.processing.segments.length !== job.timeline!.segments.length) throw fail();
  const parameters = JSON.stringify(policyAnalysisParameters(job.processing.policy));
  for (const [index, segment] of job.timeline!.segments.entries()) {
    const processed = job.processing.segments[index]!; const resolve = (relativePath: string) => resolvePackageArtifactPath({ packageRoot: root, relativePath });
    if (processed.segmentId !== segment.segmentId || processed.sidecarRelativePath !== segment.relativeGenerationPath || processed.processedSha256 !== segment.audioSha256 || processed.measuredDurationMs !== segment.durationMs || processed.status === "failed") throw fail();
    const sidecarPath = resolve(processed.sidecarRelativePath); const rawPath = resolve(processed.rawRelativePath);
    if (!existsSync(sidecarPath) || !existsSync(rawPath) || sha256FileSync(sidecarPath) !== processed.sidecarSha256 || sha256FileSync(rawPath) !== processed.rawSha256) throw fail();
    const sidecar = audioProcessingSidecarSchema.parse(JSON.parse(readFileSync(sidecarPath, "utf8")));
    if (sidecar.sentenceId !== segment.segmentId || sidecar.processedRelativePath !== segment.relativeAudioPath || sidecar.rawAudioSha256 !== processed.rawSha256 || sidecar.policyFingerprint !== job.processing.policyFingerprint ||
      sidecar.policyId !== job.processing.policyId || JSON.stringify(sidecar.analysisParameters) !== parameters) throw fail();
    const decision = processed.edgeDecision;
    if (JSON.stringify(decision ?? null) !== JSON.stringify(sidecar.edgeDecision ?? null) || (decision && (decision.rawSha256 !== processed.rawSha256 || sidecar.keptStartSample !== decision.startSample ||
      sidecar.keptEndSampleExclusive !== decision.endSampleExclusive || processed.status !== "ready"))) throw fail();
  }
}
/** Null for raw-audio jobs; processed jobs bind captions to the exact trimmed WAVs and silence policy. */
export function processedAudioFingerprint(job: NarrationAudioJob): string | null {
  return job.contract === "narration-audio-job-v2" && job.timeline ? sha({ policyFingerprint: job.processing.policyFingerprint, segments: job.processing.segments.map(s => ({ segmentId: s.segmentId, processedSha256: s.processedSha256 })) }) : null;
}
function processingSummary(result: Awaited<ReturnType<typeof processNarrationSegmentAudio>>, sidecarRelativePath: string): ProcessingSegment {
  const { sidecar } = result; const ms = (samples: number | null) => samples === null || !sidecar.rawSampleRate ? null : Math.round(samples * 1000 / sidecar.rawSampleRate);
  return { segmentId: sidecar.sentenceId, sidecarRelativePath, sidecarSha256: result.sidecarSha256, rawAudioJobId: sidecar.rawAudioJobId, rawRelativePath: sidecar.rawRelativePath, rawSha256: sidecar.rawAudioSha256,
    processedSha256: sidecar.processedAudioSha256, status: sidecar.status, removedLeadingMs: ms(sidecar.removedLeadingSamples) ?? 0, removedTrailingMs: ms(sidecar.removedTrailingSamples) ?? 0,
    rawDurationMs: ms(sidecar.rawSampleCount), measuredDurationMs: sidecar.measuredDurationMs, diagnostics: sidecar.diagnostics, ...(sidecar.edgeDecision ? { edgeDecision: sidecar.edgeDecision } : {}) };
}
export function audioJobFresh(root: string, job: NarrationAudioJob, lineage: NarrationLineage, configFingerprint: string) {
  const current = readNarration(root, job.narration.candidateId);
  const latest = latestNarrationAudioJob(root, job.narration.candidateId);
  return (!latest || latest.jobId === job.jobId) && narrationGate(current, lineage) === "approved" && current?.revision === job.narration.revision &&
    current.fingerprint === job.narration.fingerprint && job.configFingerprint === configFingerprint;
}
export function queueNarrationAudio(input: { root: string; candidateId: string; expectedRevision: number; expectedFingerprint: string;
  lineage: NarrationLineage; profile: TtsProfile; endpointIdentity: string; speed?: number }): NarrationAudioJob {
  const narration = readNarration(input.root, input.candidateId);
  if (!narration || narrationGate(narration, input.lineage) !== "approved" || narration.revision !== input.expectedRevision || narration.fingerprint !== input.expectedFingerprint) throw new NarrationError("현재 승인된 Narration을 다시 불러와주세요.");
  const speed = z.number().min(0.7).max(2).optional().parse(input.speed);
  const profile = ttsProfileSchema.parse(speed === undefined ? input.profile : { ...input.profile, speed });
  if (!profile.enabled) throw new NarrationError("음성 프로필이 비활성화되어 있습니다.");
  const latest = latestNarrationAudioJob(input.root, input.candidateId); const snapshot = processingSnapshot(currentEdgeTrimPolicy());
  if (latest && (latest.status === "queued" || latest.status === "running") &&
    audioJobFresh(input.root, latest, input.lineage, audioConfigFingerprint(profile, input.endpointIdentity, snapshot.policyFingerprint))) return latest;
  // New jobs snapshot the current default policy; v1 jobs remain readable with their raw timelines.
  const job: NarrationAudioJob = { contract: "narration-audio-job-v2", jobId: randomUUID(), narration,
    profile, configFingerprint: audioConfigFingerprint(profile, input.endpointIdentity, snapshot.policyFingerprint), endpointIdentity: input.endpointIdentity,
    createdAt: new Date(Math.max(Date.now(), latest ? Date.parse(latest.createdAt) + 1 : 0)).toISOString(), status: "queued", errorCode: null, timeline: null,
    ...(speed === undefined ? {} : { speed }), processing: { ...snapshot, sourceAudioJobId: null, segments: [] } };
  atomicWriteFile(jobPath(input.root, job.jobId), JSON.stringify(job, null, 2));
  return job;
}
/** Called only by the explicit worker; queuing/reading never calls TTS. No cross-job asset reuse. */
export async function runNarrationAudioJob(input: { root: string; jobId: string; provider: TtsProvider;
  durationProbe: AudioDurationProbe; profile: TtsProfile; endpointIdentity: string; getLineage: () => NarrationLineage }) {
  const path = jobPath(input.root, input.jobId);
  const lock = `${path}.lock`;
  mkdirSync(join(input.root, "context/narration/audio-jobs"), { recursive: true });
  try { mkdirSync(lock); } catch { throw new NarrationError("음성 작업이 이미 실행 중입니다."); }
  let job: NarrationAudioJob | null = null;
  const fresh = () => {
    try { return !!job && audioJobFresh(input.root, job, input.getLineage(), audioConfigFingerprint(input.profile, input.endpointIdentity, storedProcessingPolicy(job))); }
    catch { return false; }
  };
  const save = () => { if (job) atomicWriteFile(path, JSON.stringify(job, null, 2)); };
  try {
    job = readNarrationAudioJob(input.root, input.jobId);
    if (job.status !== "queued") throw new NarrationError("대기 중인 음성 작업만 실행할 수 있습니다.");
    if (!fresh()) { job.status = "stale"; save(); return job; }
    job.status = "running"; save();
    const runRelativeRoot = `reel/narration/v${job.narration.revision}/${job.configFingerprint}/${job.jobId}`;
    const runRoot = resolvePackageArtifactPath({ packageRoot: input.root, relativePath: runRelativeRoot });
    const guardedProvider: TtsProvider = { providerId: input.provider.providerId, generate: async request => {
      if (!fresh()) throw new NarrationError("Narration 또는 음성 설정이 바뀌었습니다.");
      return input.provider.generate(request);
    } };
    const processed: ProcessingSegment[] = []; let processingFailure: string | null = null; const owner = job;
    const processAudio: NarrationSegmentAudioProcessor | undefined = owner.contract !== "narration-audio-job-v2" ? undefined : async ({ ordinal, segmentId, rawRelativeAudioPath }) => {
      const paths = processedSegmentPaths(runRelativeRoot, ordinal, owner.processing.policyFingerprint); const runRelative = (path: string) => path.slice(runRelativeRoot.length + 1);
      const result = await processNarrationSegmentAudio({ packageRoot: input.root, rawRelativePath: `${runRelativeRoot}/${rawRelativeAudioPath}`, rawAudioJobId: owner.jobId, sentenceId: segmentId,
        audioRelativePath: paths.audio, sidecarRelativePath: paths.sidecar, durationProbe: input.durationProbe, policy: owner.processing.policy });
      processed.push(processingSummary(result, paths.sidecar));
      if (result.sidecar.status === "failed") { processingFailure = "audio_processing_failed"; throw new NarrationError("무음 정리에 실패했습니다."); }
      return { relativeAudioPath: runRelative(paths.audio), relativeGenerationPath: runRelative(paths.sidecar) };
    };
    const result = await generateNarrationMasterTimeline({ packageRoot: runRoot, candidateId: job.narration.candidateId,
      segments: job.narration.sentences.map(s => ({ segmentId: s.sentenceId, narrationText: s.text })),
      profile: job.profile, provider: guardedProvider, durationProbe: input.durationProbe, processAudio });
    if (job.contract === "narration-audio-job-v2") job.processing.segments = processed;
    if (!fresh()) { job.status = "stale"; save(); return job; }
    if (result.status !== "completed") { job.status = "failed"; job.errorCode = processingFailure ?? result.failed.code; save(); return job; }
    // Paths in the published envelope are relative to the original candidate package.
    job.timeline = { ...result.timeline, segments: result.timeline.segments.map(s => ({ ...s,
      relativeAudioPath: `${runRelativeRoot}/${s.relativeAudioPath}`,
      relativeGenerationPath: `${runRelativeRoot}/${s.relativeGenerationPath}` })) };
    // The legacy timeline schema caps paths at 200 characters. Validate before publication.
    audioMasterTimelineSchema.parse(job.timeline);
    job.status = "completed"; save(); return job;
  } catch (error) {
    if (job?.status === "running") { job.status = "failed"; job.errorCode = "generation_failed"; save(); }
    throw error;
  } finally { rmSync(lock, { recursive: true }); }
}
/** "Trim silence from existing audio": a new v2 job from a completed job's raw WAVs. Never calls the TTS provider and never edits the source job. */
export async function reprocessNarrationAudio(input: { root: string; candidateId: string; sourceJobId: string; lineage: NarrationLineage; durationProbe: AudioDurationProbe }) {
  const lock = join(input.root, "context/narration/audio-jobs/.reprocess.lock"); mkdirSync(join(input.root, "context/narration/audio-jobs"), { recursive: true });
  try { mkdirSync(lock); } catch { throw new NarrationError("무음 정리가 이미 진행 중입니다."); }
  try { return await reprocessUnlocked(input); } finally { rmSync(lock, { recursive: true }); }
}
function assertReprocessable(input: { root: string; candidateId: string; lineage: NarrationLineage }, source: NarrationAudioJob) {
  if (source.narration.candidateId !== input.candidateId || source.status !== "completed" || !source.timeline) throw new NarrationError("완료된 기존 음성 작업에서만 무음 정리를 할 수 있습니다.");
  const narration = readNarration(input.root, input.candidateId);
  if (!narration || narrationGate(narration, input.lineage) !== "approved" || narration.revision !== source.narration.revision || narration.fingerprint !== source.narration.fingerprint) throw new NarrationError("현재 승인된 Narration의 음성만 다시 정리할 수 있습니다.");
  const latest = latestNarrationAudioJob(input.root, input.candidateId);
  if (latest && (latest.status === "queued" || latest.status === "running")) throw new NarrationError("진행 중인 음성 작업이 끝난 뒤 다시 시도해주세요.");
  return latest;
}
const rawSources = (source: NarrationAudioJob) => source.contract === "narration-audio-job-v2" ? source.processing.segments.map(s => ({ rawRelativePath: s.rawRelativePath, rawAudioJobId: s.rawAudioJobId, rawSha256: s.rawSha256 }))
  : source.timeline!.segments.map(s => ({ rawRelativePath: s.relativeAudioPath, rawAudioJobId: source.jobId, rawSha256: s.audioSha256 }));
async function reprocessUnlocked(input: { root: string; candidateId: string; sourceJobId: string; lineage: NarrationLineage; durationProbe: AudioDurationProbe }) {
  const source = readNarrationAudioJob(input.root, input.sourceJobId);
  const latest = assertReprocessable(input, source);
  if (!processingPolicyOutdated(source)) throw new NarrationError("이미 현재 무음 정리 기준으로 처리된 음성입니다.");
  return processIntoNewJob(input, source, latest, currentEdgeTrimPolicy(), new Map());
}
/** New v2 job from the source job's raw WAVs: sentences with a decision are cut at its sample range, the rest are trimmed by `policy`. No TTS. */
async function processIntoNewJob(input: { root: string; candidateId: string; durationProbe: AudioDurationProbe }, source: NarrationAudioJob, latest: NarrationAudioJob | null, policy: EdgeTrimPolicy, decisions: Map<string, EdgeDecision>) {
  const snapshot = processingSnapshot(policy); const { policyFingerprint } = snapshot; const raws = rawSources(source);
  const configFingerprint = audioConfigFingerprint(source.profile, source.endpointIdentity, policyFingerprint);
  const job: ProcessedNarrationAudioJob = { contract: "narration-audio-job-v2", jobId: randomUUID(), narration: source.narration, profile: source.profile, configFingerprint, endpointIdentity: source.endpointIdentity,
    createdAt: new Date(Math.max(Date.now(), latest ? Date.parse(latest.createdAt) + 1 : 0)).toISOString(), status: "running", errorCode: null, timeline: null,
    ...(source.speed === undefined ? {} : { speed: source.speed }), processing: { ...snapshot, sourceAudioJobId: source.jobId, segments: [] } };
  const path = jobPath(input.root, job.jobId); const save = () => atomicWriteFile(path, JSON.stringify(job, null, 2)); save();
  try {
    const runRelativeRoot = `reel/narration/v${job.narration.revision}/${configFingerprint}/${job.jobId}`;
    for (const [index, sentence] of job.narration.sentences.entries()) {
      const raw = raws[index]!; const rawPath = resolvePackageArtifactPath({ packageRoot: input.root, relativePath: raw.rawRelativePath });
      if (!existsSync(rawPath) || createHash("sha256").update(readFileSync(rawPath)).digest("hex") !== raw.rawSha256) throw new NarrationError("원본 음성 파일이 없거나 변경되었습니다.", 409);
      const paths = processedSegmentPaths(runRelativeRoot, index + 1, policyFingerprint); const decision = decisions.get(sentence.sentenceId);
      const common = { packageRoot: input.root, rawRelativePath: raw.rawRelativePath, rawAudioJobId: raw.rawAudioJobId, sentenceId: sentence.sentenceId, audioRelativePath: paths.audio, sidecarRelativePath: paths.sidecar, durationProbe: input.durationProbe, policy: snapshot.policy };
      if (decision && decision.rawSha256 !== raw.rawSha256) throw new NarrationError("원본 음성이 바뀌어 선택한 구간을 쓸 수 없습니다.", 409);
      const result = decision ? await processNarrationSegmentRange({ ...common, decision }) : await processNarrationSegmentAudio(common);
      job.processing.segments.push(processingSummary(result, paths.sidecar));
      if (result.sidecar.status === "failed") { job.status = "failed"; job.errorCode = "audio_processing_failed"; save(); return job; }
    }
    const timeline = buildAudioMasterTimeline({ candidateId: input.candidateId, profileId: job.profile.profileId, generatedAt: new Date().toISOString(),
      segments: job.processing.segments.map((s, index) => ({ segmentId: s.segmentId, ordinal: index + 1, text: normalizeNarrationForTts(job.narration.sentences[index]!.text),
        relativeAudioPath: processedSegmentPaths(runRelativeRoot, index + 1, policyFingerprint).audio, relativeGenerationPath: s.sidecarRelativePath, audioSha256: s.processedSha256!, durationMs: s.measuredDurationMs! })) });
    job.timeline = audioMasterTimelineSchema.parse(timeline); job.status = "completed"; save(); return readNarrationAudioJob(input.root, job.jobId);
  } catch (error) { if (job.status === "running") { job.status = "failed"; job.errorCode = "audio_processing_failed"; save(); } throw error; }
}

export const edgeRangeMutationSchema = z.object({ action: z.literal("apply-edge-ranges"), sourceJobId: z.string().uuid(),
  decisions: z.array(z.object({ sentenceId: z.string().uuid(), mode: z.enum(["auto_range", "manual_range"]), startSample: z.number().int().nonnegative(), endSampleExclusive: z.number().int().positive(),
    expectedRawSha256: hash, acknowledgedWarnings: z.array(z.string().max(80)).max(10) }).strict()).min(1).max(16) }).strict();
export const edgeWarningLabels: Record<string, string> = { leading_trim_exceeds_1500ms: "앞부분을 1.5초 넘게 자릅니다", trailing_trim_exceeds_1500ms: "뒷부분을 1.5초 넘게 자릅니다",
  total_trim_at_least_40_percent: "원본의 40% 이상을 자릅니다", kept_audio_too_short: "남는 음성이 0.2초보다 짧습니다", cuts_detected_speech: "자동으로 찾은 말소리 구간 일부가 잘립니다", no_speech_detected: "자동 분석에서 말소리를 찾지 못했습니다" };
/** Warnings the reviewer must acknowledge for keeping [start, end): the policy's review limits plus cutting into detected speech. */
function edgeRangeWarnings(raw: Buffer, policy: EdgeTrimPolicy, start: number, end: number) {
  const wav = parsePcmWav(raw); const analysis = analyzeEdges(raw, wav, policy); const warnings = rangeTrimDiagnostics(wav, start, end, policy);
  if (analysis.detectedSpeechStartSample === null) warnings.push("no_speech_detected");
  else if (start > analysis.detectedSpeechStartSample || end < analysis.detectedSpeechEndSampleExclusive!) warnings.push("cuts_detected_speech");
  return { wav, analysis, warnings };
}
const rawOf = (root: string, segment: ProcessingSegment) => {
  const path = resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.rawRelativePath }); const raw = existsSync(path) ? readFileSync(path) : null;
  if (!raw || createHash("sha256").update(raw).digest("hex") !== segment.rawSha256) throw new NarrationError("원본 음성 파일이 없거나 변경되었습니다.", 409);
  return raw;
};
/** Review data for one sentence's raw WAV: peak waveform, detected speech, the automatic suggestion and its warnings, and any decision in effect. */
export function edgeReviewView(root: string, job: NarrationAudioJob, sentenceId: string, buckets = 800) {
  if (job.contract !== "narration-audio-job-v2" || job.status !== "completed") throw new NarrationError("무음 정리가 끝난 음성 작업만 검토할 수 있습니다.", 409);
  const segment = job.processing.segments.find(s => s.segmentId === sentenceId); if (!segment) throw new NarrationError("음성 작업에 없는 문장입니다.", 404);
  const raw = rawOf(root, segment); const wav = parsePcmWav(raw); const analysis = analyzeEdges(raw, wav, job.processing.policy);
  const suggestion = analysis.suggestedKeptStartSample === null ? null
    : { startSample: analysis.suggestedKeptStartSample, endSampleExclusive: analysis.suggestedKeptEndSampleExclusive!, warnings: edgeRangeWarnings(raw, job.processing.policy, analysis.suggestedKeptStartSample, analysis.suggestedKeptEndSampleExclusive!).warnings };
  const sidecar = audioProcessingSidecarSchema.parse(JSON.parse(readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: segment.sidecarRelativePath }), "utf8")));
  return { sentenceId, status: segment.status, diagnostics: segment.diagnostics, rawSha256: segment.rawSha256, sampleRate: wav.sampleRate, rawSampleCount: wav.frameCount, ...wavePeaks(raw, wav, buckets),
    detected: analysis.detectedSpeechStartSample === null ? null : { startSample: analysis.detectedSpeechStartSample, endSampleExclusive: analysis.detectedSpeechEndSampleExclusive! },
    suggestion, current: { startSample: sidecar.keptStartSample, endSampleExclusive: sidecar.keptEndSampleExclusive }, decision: segment.edgeDecision ?? null, policyReview: job.processing.policy.review,
    editable: segment.status === "review_required" || !!segment.edgeDecision };
}
/**
 * Applies reviewer-chosen edge ranges as a NEW audio job (source job, raw and processed WAVs untouched; no TTS). Sentences not in the request keep
 * an earlier decision only while its raw bytes are unchanged; all others are trimmed again with the source job's recorded policy.
 * The new job becomes the latest audio, so scene plan, captions, alignment, motion and render go stale as with any audio change.
 */
export async function applyEdgeRanges(input: { root: string; candidateId: string; mutation: z.infer<typeof edgeRangeMutationSchema>; lineage: NarrationLineage; durationProbe: AudioDurationProbe }) {
  const lock = join(input.root, "context/narration/audio-jobs/.reprocess.lock"); mkdirSync(join(input.root, "context/narration/audio-jobs"), { recursive: true });
  try { mkdirSync(lock); } catch { throw new NarrationError("무음 정리가 이미 진행 중입니다."); }
  try {
    const { mutation } = input; const source = readNarrationAudioJob(input.root, mutation.sourceJobId); const latest = assertReprocessable(input, source);
    if (source.contract !== "narration-audio-job-v2") throw new NarrationError("무음 정리 작업에서만 구간을 지정할 수 있습니다.", 409);
    if (latest?.jobId !== source.jobId) throw new NarrationError("최신 음성 작업에서만 구간을 지정할 수 있습니다. 다시 불러와주세요.", 409);
    if (new Set(mutation.decisions.map(d => d.sentenceId)).size !== mutation.decisions.length) throw new NarrationError("같은 문장의 구간이 중복되었습니다.", 400);
    const decisions = new Map<string, EdgeDecision>(); const decidedAt = new Date().toISOString();
    for (const segment of source.processing.segments) if (segment.edgeDecision && segment.edgeDecision.rawSha256 === segment.rawSha256) decisions.set(segment.segmentId, segment.edgeDecision);
    for (const request of mutation.decisions) {
      const segment = source.processing.segments.find(s => s.segmentId === request.sentenceId); if (!segment) throw new NarrationError("음성 작업에 없는 문장입니다.", 404);
      if (segment.status !== "review_required" && !segment.edgeDecision) throw new NarrationError("검토 필요 상태이거나 이미 구간을 지정한 문장만 바꿀 수 있습니다.", 409);
      if (segment.rawSha256 !== request.expectedRawSha256) throw new NarrationError("원본 음성이 바뀌었습니다. 다시 불러온 뒤 구간을 지정해주세요.", 409);
      const raw = rawOf(input.root, segment); const { wav, analysis, warnings } = edgeRangeWarnings(raw, source.processing.policy, request.startSample, request.endSampleExclusive);
      if (!(request.startSample < request.endSampleExclusive && request.endSampleExclusive <= wav.frameCount)) throw new NarrationError(`구간은 0 ≤ 시작 < 끝 ≤ ${wav.frameCount} 샘플이어야 합니다.`, 400);
      if (request.mode === "auto_range" && (analysis.suggestedKeptStartSample !== request.startSample || analysis.suggestedKeptEndSampleExclusive !== request.endSampleExclusive)) throw new NarrationError("자동 제안 구간과 다릅니다. 직접 지정으로 선택해주세요.", 409);
      const missing = warnings.filter(w => !request.acknowledgedWarnings.includes(w));
      if (missing.length) throw new NarrationError(`확인이 필요한 경고가 있습니다: ${missing.map(w => edgeWarningLabels[w] ?? w).join(", ")}`, 409);
      decisions.set(segment.segmentId, edgeDecisionSchema.parse({ mode: request.mode, rawSha256: segment.rawSha256, rawSampleCount: wav.frameCount, sampleRate: wav.sampleRate, startSample: request.startSample,
        endSampleExclusive: request.endSampleExclusive, warnings, acknowledgedWarnings: request.acknowledgedWarnings.filter(w => warnings.includes(w)), decidedAt }));
    }
    return await processIntoNewJob(input, source, latest, source.processing.policy, decisions);
  } finally { rmSync(lock, { recursive: true }); }
}
