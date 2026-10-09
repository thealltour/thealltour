import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import { readMotionJob, writeMotionJob, motionJobFresh } from "./service";
import { executeMiniMotion } from "./transport";

const responseSchema = z.object({ contract: z.literal("narration-scene-motion-output-v1"), jobId: z.string().uuid(), inputFingerprint: z.string().length(64),
  runnerSha256: z.string().length(64), imageSha256: z.string().length(64), sha256: z.string().length(64), byteSize: z.number().int().positive().max(24 * 1024 * 1024),
  width: z.literal(720), height: z.literal(1280), fps: z.literal(30), frameCount: z.number().int().positive(), durationMs: z.number().int().positive(),
  videoBase64: z.string(), device: z.literal("cpu"),
}).passthrough();
export async function runMotionJob(root: string, jobId: string) {
  let job = readMotionJob(root, jobId);
  if (!["queued", "running"].includes(job.status)) return job;
  if (!motionJobFresh(root, job)) { job = { ...job, status: "stale", approval: null, output: null }; writeMotionJob(root, job); return job; }
  job = { ...job, status: "running", startedAt: job.startedAt ?? new Date().toISOString(), heartbeatAt: new Date().toISOString(), errorCode: null }; writeMotionJob(root, job);
  // The persistent worker is serialized with flock; a restart recovers the same remote job ID.
  const timer = setInterval(() => { job = { ...job, heartbeatAt: new Date().toISOString() }; writeMotionJob(root, job); }, 10_000);
  try {
    const image = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: job.source.imageRelativePath }));
    if (sha256Buffer(image) !== job.source.imageSha256) throw new Error("image_changed");
    const frameCount = job.source.endFrame - job.source.startFrame;
    const request = JSON.stringify({ contract: "narration-scene-motion-input-v1", jobId, inputFingerprint: job.inputFingerprint,
      config: job.config, frameCount, imageSha256: job.source.imageSha256, imageBase64: image.toString("base64") });
    let raw = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try { raw = await executeMiniMotion(request); break; }
      catch (error) { if (attempt === 1 || !motionJobFresh(root, job)) throw error; }
    }
    const result = responseSchema.parse(JSON.parse(raw));
    if (result.jobId !== jobId || result.inputFingerprint !== job.inputFingerprint || result.imageSha256 !== job.source.imageSha256 ||
      result.runnerSha256 !== job.config.runnerSha256 || result.frameCount !== frameCount || Math.abs(result.durationMs - frameCount * 1000 / 30) > 1) throw new Error("remote_identity_mismatch");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(result.videoBase64)) throw new Error("remote_encoding_invalid");
    const video = Buffer.from(result.videoBase64, "base64");
    if (video.length !== result.byteSize || sha256Buffer(video) !== result.sha256) throw new Error("remote_hash_mismatch");
    if (!motionJobFresh(root, job)) { job.status = "stale"; return job; }
    const prefix = `media/narration-motion/${job.inputFingerprint}/${jobId}`;
    const relativePath = `${prefix}/scene.mp4`;
    const outputPath = resolvePackageArtifactPath({ packageRoot: root, relativePath }); atomicWriteFile(outputPath, video);
    const probe = await promisify(execFile)("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,width,height,r_frame_rate,nb_read_frames:format=duration", "-of", "json", outputPath], { timeout: 120_000, maxBuffer: 128 * 1024 });
    const metadata = JSON.parse(probe.stdout) as { streams: Array<{ codec_type: string; width: number; height: number; r_frame_rate: string; nb_read_frames: string }>; format: { duration: string } };
    const stream = metadata.streams[0];
    if (metadata.streams.length !== 1 || !stream || stream.codec_type !== "video" || stream.width !== 720 || stream.height !== 1280 || stream.r_frame_rate !== "30/1" || Number(stream.nb_read_frames) !== frameCount || Math.abs(Number(metadata.format.duration) * 1000 - result.durationMs) > 50) throw new Error("remote_metadata_invalid");
    await runFfmpeg({ args: ["-v", "error", "-i", outputPath, "-f", "null", "-"], timeoutMs: 120_000 });
    const { videoBase64: _video, ...manifest } = result;
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
    const manifestRelativePath = `${prefix}/execution.json`;
    atomicWriteFile(resolvePackageArtifactPath({ packageRoot: root, relativePath: manifestRelativePath }), manifestBytes);
    if (!motionJobFresh(root, job)) { job.status = "stale"; return job; }
    job = { ...job, status: "completed", completedAt: new Date().toISOString(), output: { relativePath, sha256: result.sha256, byteSize: result.byteSize,
      width: 720, height: 1280, fps: 30, frameCount, durationMs: result.durationMs, manifestRelativePath, manifestSha256: sha256Buffer(manifestBytes) } };
    return job;
  } catch (error) {
    const errorCode = error instanceof Error && error.message === "motion_bounds_exceeded" ? "motion_bounds_exceeded" : "motion_generation_failed";
    job = { ...job, status: motionJobFresh(root, job) ? "failed" : "stale", errorCode, output: null, approval: null };
    return job;
  } finally { clearInterval(timer); writeMotionJob(root, job); }
}
