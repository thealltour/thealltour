import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { ttsProfileSchema, type TtsProfile } from "@/lib/marketing/tts/contracts";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import type { AudioDurationProbe } from "@/lib/marketing/tts/duration/probe";
import { generateNarrationMasterTimeline } from "@/lib/marketing/tts/timeline/orchestrate";
import { audioMasterTimelineSchema } from "@/lib/marketing/tts/timeline/contracts";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
import { narrationSchema, type NarrationLineage } from "./contracts";
import { contentFingerprint, narrationGate, NarrationError, readNarration } from "./persistence";
import { stableFingerprint } from "./fingerprint";

const sha = stableFingerprint;
const jobSchema = z.object({
  contract: z.literal("narration-audio-job-v1"), jobId: z.string().uuid(),
  narration: narrationSchema, profile: ttsProfileSchema, configFingerprint: z.string().length(64),
  endpointIdentity: z.string().min(1), createdAt: z.string().datetime(),
  status: z.enum(["queued", "running", "completed", "failed", "stale"]),
  errorCode: z.string().nullable(), timeline: audioMasterTimelineSchema.nullable(),
}).strict();
export type NarrationAudioJob = z.infer<typeof jobSchema>;
export function resolveNarrationAudioProfile(profileId: string): TtsProfile {
  const raw = process.env.NARRATION_TTS_PROFILE_JSON?.trim();
  if (raw) {
    const profile = ttsProfileSchema.parse(JSON.parse(raw));
    if (profile.profileId === profileId && profile.enabled) return profile;
  }
  // Legacy development profiles are available only by their explicit IDs.
  return resolveTtsProfile(profileId);
}
export function audioConfigFingerprint(profile: TtsProfile, endpointIdentity: string) {
  const endpoint = new URL(endpointIdentity);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new NarrationError("TTS 주소에 인증 정보나 query를 포함할 수 없습니다.", 400);
  return sha({ profile, endpointIdentity, algorithm: "sentence-wav-ffprobe-v1", pauseMs: 250, trailingPauseMs: 0 });
}
function jobPath(root: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("음성 작업 ID가 올바르지 않습니다.", 400);
  return join(root, "context/narration/audio-jobs", `${jobId}.json`);
}
export function readNarrationAudioJob(root: string, jobId: string): NarrationAudioJob {
  const path = jobPath(root, jobId);
  if (!existsSync(path)) throw new NarrationError("음성 작업을 찾을 수 없습니다.", 404);
  const job = jobSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (job.jobId !== jobId || job.configFingerprint !== audioConfigFingerprint(job.profile, job.endpointIdentity) ||
    job.narration.fingerprint !== contentFingerprint(job.narration) ||
    !job.narration.approval || job.narration.approval.revision !== job.narration.revision || job.narration.approval.fingerprint !== job.narration.fingerprint ||
    job.narration.sentences.some((s, index) => s.order !== index) ||
    new Set(job.narration.sentences.map(s => s.sentenceId)).size !== job.narration.sentences.length) throw new NarrationError("음성 작업 연결 정보가 일치하지 않습니다.", 500);
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
  }
  return job;
}
export function audioJobFresh(root: string, job: NarrationAudioJob, lineage: NarrationLineage, configFingerprint: string) {
  const current = readNarration(root, job.narration.candidateId);
  return narrationGate(current, lineage) === "approved" && current?.revision === job.narration.revision &&
    current.fingerprint === job.narration.fingerprint && job.configFingerprint === configFingerprint;
}
export function queueNarrationAudio(input: { root: string; candidateId: string; expectedRevision: number; expectedFingerprint: string;
  lineage: NarrationLineage; profile: TtsProfile; endpointIdentity: string }): NarrationAudioJob {
  const narration = readNarration(input.root, input.candidateId);
  if (!narration || narrationGate(narration, input.lineage) !== "approved" || narration.revision !== input.expectedRevision || narration.fingerprint !== input.expectedFingerprint) throw new NarrationError("현재 승인된 Narration을 다시 불러와주세요.");
  const profile = ttsProfileSchema.parse(input.profile);
  if (!profile.enabled) throw new NarrationError("음성 프로필이 비활성화되어 있습니다.");
  const job: NarrationAudioJob = { contract: "narration-audio-job-v1", jobId: randomUUID(), narration,
    profile, configFingerprint: audioConfigFingerprint(profile, input.endpointIdentity), endpointIdentity: input.endpointIdentity,
    createdAt: new Date().toISOString(), status: "queued", errorCode: null, timeline: null };
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
  const configFingerprint = audioConfigFingerprint(input.profile, input.endpointIdentity);
  const fresh = () => {
    try { return !!job && audioJobFresh(input.root, job, input.getLineage(), configFingerprint); }
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
    const result = await generateNarrationMasterTimeline({ packageRoot: runRoot, candidateId: job.narration.candidateId,
      segments: job.narration.sentences.map(s => ({ segmentId: s.sentenceId, narrationText: s.text })),
      profile: job.profile, provider: guardedProvider, durationProbe: input.durationProbe });
    if (!fresh()) { job.status = "stale"; save(); return job; }
    if (result.status !== "completed") { job.status = "failed"; job.errorCode = result.failed.code; save(); return job; }
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
