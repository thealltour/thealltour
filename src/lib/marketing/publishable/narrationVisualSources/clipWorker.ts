import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import { downloadToFileWithAllowlist } from "@/lib/marketing/assets/shortform/production/download";
import { PEXELS_DOWNLOAD_HOST_ALLOWLIST, PIXABAY_DOWNLOAD_HOST_ALLOWLIST } from "@/lib/marketing/assets/shortform/production/paths";
import { setTimeout as pause } from "node:timers/promises";
import { NarrationError } from "../narration/persistence";
import { sceneHash, withSceneLock } from "../narrationScenes/service";
import { stockProvenanceSchema, type StockClipJob } from "./contracts";
import { fitUsable, renditionFit } from "./fit";
import { lookupStockVideo, PROVIDER_TERMS } from "./providers";
import { readStockClipJob, stockClipJobFresh, stockClipPrefix, stockOriginalDirectory, writeStockClipJob } from "./clips";

const run = promisify(execFile);
const ALLOW_HOSTS = { pexels: PEXELS_DOWNLOAD_HOST_ALLOWLIST, pixabay: PIXABAY_DOWNLOAD_HOST_ALLOWLIST } as const;
class ClipError extends Error {}
type Probe = { streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; nb_read_frames?: string; duration?: string;
  tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number }> }>; format: { duration?: string } };
async function probe(path: string, countFrames: boolean) {
  const args = ["-v", "error", ...(countFrames ? ["-count_frames"] : []), "-show_entries", "stream=codec_type,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration:stream_tags=rotate:stream_side_data=rotation:format=duration", "-of", "json", path];
  return JSON.parse((await run("ffprobe", args, { timeout: 180_000, maxBuffer: 1024 * 1024 })).stdout) as Probe;
}
/** Reuse an intact original by content hash; otherwise download it, refreshing the URL only for the same provider/videoId/fileKey/size. */
async function ensureOriginal(root: string, job: StockClipJob): Promise<{ job: StockClipJob; relativePath: string; sha256: string; byteSize: number; downloadedAt: string; downloadHost: string }> {
  const directory = stockOriginalDirectory(job.source); const latestPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${directory}/latest.json` });
  if (existsSync(latestPath)) {
    try {
      const latest = JSON.parse(readFileSync(latestPath, "utf8")) as { sha256: string; byteSize: number; downloadedAt: string; downloadHost: string };
      const relativePath = `${directory}/${latest.sha256}.mp4`; const absolute = resolvePackageArtifactPath({ packageRoot: root, relativePath });
      if (/^[a-f0-9]{64}$/.test(latest.sha256) && existsSync(absolute) && statSync(absolute).size === latest.byteSize && sha256FileSync(absolute) === latest.sha256) return { job, relativePath, ...latest };
    } catch { /* Download again. */ }
  }
  const temporary = resolvePackageArtifactPath({ packageRoot: root, relativePath: `${directory}/download-${job.jobId}.part` });
  mkdirSync(dirname(temporary), { recursive: true });
  const download = (url: string) => downloadToFileWithAllowlist({ url, destinationAbsolutePath: temporary, allowHosts: ALLOW_HOSTS[job.source.provider], timeoutMs: 180_000, acceptedContentTypePrefixes: ["video/", "application/octet-stream"] });
  let current = job; let result: Awaited<ReturnType<typeof download>>;
  try { result = await download(job.downloadUrl); }
  catch {
    const video = await lookupStockVideo({ provider: job.source.provider, videoId: job.source.videoId });
    const rendition = video?.renditions.find(r => r.fileKey === job.source.rendition.fileKey && r.width === job.source.rendition.width && r.height === job.source.rendition.height);
    if (!video || !rendition || video.provider !== job.source.provider || video.videoId !== job.source.videoId || rendition.url === job.downloadUrl) throw new ClipError("download_url_unavailable");
    current = { ...job, downloadUrl: rendition.url }; writeStockClipJob(root, current);
    try { result = await download(rendition.url); } catch { throw new ClipError("download_failed"); }
  }
  const sha256 = sha256FileSync(temporary); const byteSize = statSync(temporary).size;
  const relativePath = `${directory}/${sha256}.mp4`; renameSync(temporary, resolvePackageArtifactPath({ packageRoot: root, relativePath }));
  const record = { sha256, byteSize, downloadedAt: new Date().toISOString(), downloadHost: new URL(result.finalUrl).hostname };
  atomicWriteFile(latestPath, JSON.stringify(record, null, 2));
  return { job: current, relativePath, ...record };
}
export async function runStockClipJob(root: string, jobId: string) {
  let job = readStockClipJob(root, jobId);
  if (!["queued", "running"].includes(job.status)) return job;
  if (!stockClipJobFresh(root, job)) { job = { ...job, status: "stale", approval: null }; writeStockClipJob(root, job); return job; }
  job = { ...job, status: "running", startedAt: job.startedAt ?? new Date().toISOString(), heartbeatAt: new Date().toISOString(), errorCode: null, original: null, output: null, approval: null }; writeStockClipJob(root, job);
  const timer = setInterval(() => { job = { ...job, heartbeatAt: new Date().toISOString() }; writeStockClipJob(root, job); }, 10_000);
  const frameCount = job.source.endFrame - job.source.startFrame; const neededMs = frameCount * 1000 / 30;
  const settled = await (async (): Promise<StockClipJob> => { try {
    const original = await ensureOriginal(root, job); job = { ...original.job, heartbeatAt: new Date().toISOString() };
    const originalPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: original.relativePath });
    const source = await probe(originalPath, false).catch(() => { throw new ClipError("source_unreadable"); }); const video = source.streams.find(s => s.codec_type === "video");
    if (!video?.width || !video.height) throw new ClipError("source_unreadable");
    // ffmpeg autorotates on decode, so a ±90° rotation swaps the effective frame size.
    const rotation = Math.abs(Number(video.side_data_list?.find(d => typeof d.rotation === "number")?.rotation ?? video.tags?.rotate ?? 0)) % 180;
    const [width, height] = rotation === 90 ? [video.height, video.width] : [video.width, video.height];
    const fit = renditionFit(width, height);
    if (!fitUsable(fit)) throw new ClipError(fit.scale > 1 ? "source_resolution_insufficient" : "source_crop_excessive");
    const durationMs = Math.floor(Number(video.duration ?? source.format.duration) * 1000);
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new ClipError("source_unreadable");
    if (job.source.startMs + neededMs > durationMs) throw new ClipError("source_too_short");
    job.original = { relativePath: original.relativePath, sha256: original.sha256, byteSize: original.byteSize, downloadedAt: original.downloadedAt, downloadHost: original.downloadHost,
      width, height, durationMs, avgFrameRate: video.avg_frame_rate ?? "unknown", hadAudio: source.streams.some(s => s.codec_type === "audio") };
    const prefix = stockClipPrefix(job); const outputRelative = `${prefix}/scene.mp4`;
    const outputPath = resolvePackageArtifactPath({ packageRoot: root, relativePath: outputRelative }); mkdirSync(dirname(outputPath), { recursive: true });
    const { width: W, height: H, fps, crf, preset, pixelFormat } = job.config;
    // Decoded-time seek, cover crop, constant 30fps, exact frame count, no audio. A short source yields fewer frames and fails the check below.
    await runFfmpeg({ args: ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-ss", (job.source.startMs / 1000).toFixed(3), "-i", originalPath, "-map", "0:v:0", "-an", "-sn", "-dn",
      "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=${fps},format=${pixelFormat}`,
      "-frames:v", String(frameCount), "-r", String(fps), "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-pix_fmt", pixelFormat, "-threads", "4", "-movflags", "+faststart", "-f", "mp4", outputPath], timeoutMs: 15 * 60_000 });
    const out = await probe(outputPath, true); const stream = out.streams[0];
    const outDurationMs = Math.round(Number(out.format.duration) * 1000);
    if (out.streams.length !== 1 || !stream || stream.codec_type !== "video" || stream.width !== W || stream.height !== H || stream.r_frame_rate !== "30/1" ||
      Number(stream.nb_read_frames) !== frameCount || Math.abs(outDurationMs - neededMs) > 50) throw new ClipError(Number(stream?.nb_read_frames) < frameCount ? "source_too_short" : "output_invalid");
    await runFfmpeg({ args: ["-v", "error", "-i", outputPath, "-f", "null", "-"], timeoutMs: 180_000 });
    if (!stockClipJobFresh(root, job)) { job = { ...job, status: "stale" }; return job; }
    const resultSha256 = sha256FileSync(outputPath);
    const provenance = stockProvenanceSchema.parse({ contract: "narration-stock-clip-provenance-v1", jobId, inputFingerprint: job.inputFingerprint, provider: job.source.provider, videoId: job.source.videoId,
      creatorName: job.source.creatorName, creatorUrl: job.source.creatorUrl, pageUrl: job.source.pageUrl, rendition: job.source.rendition, downloadedAt: original.downloadedAt, downloadHost: original.downloadHost,
      originalSha256: original.sha256, originalByteSize: original.byteSize, usedRange: { startMs: job.source.startMs, durationMs: Math.round(neededMs), frameCount },
      normalization: job.config, normalizationFingerprint: sceneHash(job.config), resultSha256, placeReview: job.source.placeReview,
      terms: { ...PROVIDER_TERMS[job.source.provider], perVideoLicenseFromApi: null } });
    const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2)); const provenanceRelative = `${prefix}/provenance.json`;
    atomicWriteFile(resolvePackageArtifactPath({ packageRoot: root, relativePath: provenanceRelative }), provenanceBytes);
    job = { ...job, status: "completed", completedAt: new Date().toISOString(), output: { relativePath: outputRelative, sha256: resultSha256, byteSize: statSync(outputPath).size,
      width: 720, height: 1280, fps: 30, frameCount, durationMs: outDurationMs, provenanceRelativePath: provenanceRelative, provenanceSha256: sha256Buffer(provenanceBytes) } };
    return job;
  } catch (error) {
    const errorCode = error instanceof ClipError ? error.message : "normalize_failed";
    job = { ...job, status: stockClipJobFresh(root, job) ? "failed" : "stale", errorCode, original: null, output: null, approval: null };
    return job;
  } finally {
    clearInterval(timer);
    rmSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: `${stockOriginalDirectory(job.source)}/download-${jobId}.part` }), { force: true });
  } })();
  return finishUnderLock(root, settled);
}
/**
 * The final record is written under the scene lock after one more freshness check, so a selection switched to another
 * candidate or to image motion while this job ran is never reported as this job's current, completed result.
 * The worker only writes its own job file; it never touches the selection or the per-scene current-job index.
 */
async function finishUnderLock(root: string, job: StockClipJob) {
  const settle = () => { const final = job.status === "completed" && !stockClipJobFresh(root, job) ? { ...job, status: "stale" as const } : job; writeStockClipJob(root, final); return final; };
  for (let attempt = 0; attempt < 40; attempt++) {
    try { return withSceneLock(root, settle); } catch (error) { if (!(error instanceof NarrationError) || !error.message.startsWith("다른 저장이 진행 중")) throw error; }
    await pause(250);
  }
  // Readers recompute freshness, so a record written without the lock still cannot be used as a current result.
  return settle();
}
