import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { loadSceneSource, withSceneLock } from "../narrationScenes/service";
import { readNarrationAudioJob, type NarrationAudioJob } from "./audio";
import { NarrationError } from "./persistence";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
/** One explicit "keep raw length" decision. It binds the exact raw and used WAV bytes plus the job's recorded policy; any change orphans it. */
export const audioReviewApprovalSchema = z.object({ sentenceId: z.string().uuid(), rawSha256: hash, processedSha256: hash, policyFingerprint: hash,
  decision: z.literal("keep_raw_range"), audioJobId: z.string().uuid(), approvedAt: z.string().datetime() }).strict();
export type AudioReviewApproval = z.infer<typeof audioReviewApprovalSchema>;
const fileSchema = z.object({ contract: z.literal("narration-audio-review-approvals-v1"), candidateId: z.string().min(1), approvals: z.array(audioReviewApprovalSchema).max(500) }).strict();
export const audioReviewMutationSchema = z.object({ action: z.literal("approve-keep-raw"), audioJobId: z.string().uuid(), sentenceId: z.string().uuid(), expectedRawSha256: hash, expectedProcessedSha256: hash }).strict();

const approvalsPath = (root: string) => join(root, "context/narration/audio-review/approvals.json");
function readApprovals(root: string, candidateId: string): AudioReviewApproval[] {
  const path = approvalsPath(root); if (!existsSync(path)) return [];
  const file = fileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (file.candidateId !== candidateId) throw new NarrationError("음성 검토 승인 파일의 후보가 일치하지 않습니다.", 500);
  return file.approvals;
}
const matches = (approval: AudioReviewApproval, sentenceId: string, rawSha256: string, processedSha256: string | null, policyFingerprint: string) =>
  approval.sentenceId === sentenceId && approval.rawSha256 === rawSha256 && approval.processedSha256 === processedSha256 && approval.policyFingerprint === policyFingerprint;
/** `failed` segments are never listed: a failed job has no timeline and approval cannot bypass it. */
export function audioReviewState(root: string, job: NarrationAudioJob) {
  if (job.contract !== "narration-audio-job-v2" || job.status !== "completed") return { segments: [], approvals: [] as AudioReviewApproval[], pending: [] as string[] };
  const stored = readApprovals(root, job.narration.candidateId);
  const segments = job.processing.segments.flatMap((segment, index) => segment.status !== "review_required" ? [] : [{ sentenceId: segment.segmentId, ordinal: index + 1,
    rawSha256: segment.rawSha256, processedSha256: segment.processedSha256!, diagnostics: segment.diagnostics,
    approval: stored.find(a => matches(a, segment.segmentId, segment.rawSha256, segment.processedSha256, job.processing.policyFingerprint)) ?? null }]);
  return { segments, approvals: segments.flatMap(s => s.approval ? [s.approval] : []), pending: segments.filter(s => !s.approval).map(s => s.sentenceId) };
}
export function audioReviewPendingMessage(job: NarrationAudioJob, pending: string[]) {
  const ordinals = pending.map(id => job.narration.sentences.findIndex(s => s.sentenceId === id) + 1);
  return `${ordinals.join(", ")}번째 문장은 무음 정리 검토가 필요합니다. 원본 음성을 들어본 뒤 ‘원본 길이 유지로 승인’을 선택해주세요.`;
}
export function approveKeepRawRange(input: { root: string; candidateId: string; mutation: z.infer<typeof audioReviewMutationSchema> }) {
  const { mutation } = input;
  return withSceneLock(input.root, () => {
    loadSceneSource(input.root, input.candidateId, mutation.audioJobId);
    const job = readNarrationAudioJob(input.root, mutation.audioJobId);
    if (job.contract !== "narration-audio-job-v2") throw new NarrationError("무음 정리 작업만 승인할 수 있습니다.", 409);
    const segment = job.processing.segments.find(s => s.segmentId === mutation.sentenceId);
    if (!segment) throw new NarrationError("음성 작업에 없는 문장입니다.", 404);
    if (segment.status === "failed") throw new NarrationError("무음 정리에 실패한 문장은 승인으로 진행할 수 없습니다.", 409);
    if (segment.status !== "review_required") throw new NarrationError("검토 필요 상태인 문장만 원본 길이 유지로 승인할 수 있습니다.", 409);
    if (segment.rawSha256 !== mutation.expectedRawSha256 || segment.processedSha256 !== mutation.expectedProcessedSha256) throw new NarrationError("음성이 바뀌었습니다. 다시 불러온 뒤 들어보고 승인해주세요.", 409);
    const approval: AudioReviewApproval = { sentenceId: segment.segmentId, rawSha256: segment.rawSha256, processedSha256: segment.processedSha256!,
      policyFingerprint: job.processing.policyFingerprint, decision: "keep_raw_range", audioJobId: job.jobId, approvedAt: new Date().toISOString() };
    const approvals = readApprovals(input.root, input.candidateId).filter(a => !matches(a, approval.sentenceId, approval.rawSha256, approval.processedSha256, approval.policyFingerprint));
    atomicWriteFile(approvalsPath(input.root), JSON.stringify(fileSchema.parse({ contract: "narration-audio-review-approvals-v1", candidateId: input.candidateId, approvals: [...approvals, approval] }), null, 2), 0o600);
    return audioReviewState(input.root, job);
  });
}
