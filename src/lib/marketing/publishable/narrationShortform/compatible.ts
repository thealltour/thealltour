import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { NarrationError } from "../narration/persistence";
import { readShortformJob, shortformJobFresh, requireFreshShortformOutput } from "./service";
import { readMotionShortformJob, motionShortformFresh, requireMotionShortformOutput, readCaptionShortformJob, captionShortformFresh, requireCaptionShortformOutput } from "./motionService";
const contracts = ["narration-shortform-render-job-v1", "narration-shortform-render-job-v2", "narration-shortform-render-job-v3"] as const;
export function shortformContract(root: string, jobId: string): (typeof contracts)[number] {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("렌더 작업 ID를 확인해주세요.", 400);
  const contract = JSON.parse(readFileSync(join(root, "context/narration/shortform-jobs", `${jobId}.json`), "utf8")).contract;
  if (!contracts.includes(contract)) throw new NarrationError("지원하지 않는 렌더 계약입니다.", 409);
  return contract;
}
/** v2 and v3 both run only through the serialized persistent motion worker. */
export function isMotionShortform(root: string, jobId: string) { return shortformContract(root, jobId) !== "narration-shortform-render-job-v1"; }
export function readCompatibleShortform(root: string, jobId: string) {
  const contract = shortformContract(root, jobId);
  return contract === "narration-shortform-render-job-v3" ? readCaptionShortformJob(root, jobId) : contract === "narration-shortform-render-job-v2" ? readMotionShortformJob(root, jobId) : readShortformJob(root, jobId);
}
export function compatibleShortformFresh(root: string, jobId: string) {
  const contract = shortformContract(root, jobId);
  return contract === "narration-shortform-render-job-v3" ? captionShortformFresh(root, readCaptionShortformJob(root, jobId)) : contract === "narration-shortform-render-job-v2" ? motionShortformFresh(root, readMotionShortformJob(root, jobId)) : shortformJobFresh(root, readShortformJob(root, jobId));
}
export function requireCompatibleShortformOutput(root: string, candidateId: string, jobId: string) {
  const contract = shortformContract(root, jobId);
  return contract === "narration-shortform-render-job-v3" ? requireCaptionShortformOutput(root, candidateId, jobId) : contract === "narration-shortform-render-job-v2" ? requireMotionShortformOutput(root, candidateId, jobId) : requireFreshShortformOutput(root, candidateId, jobId);
}
