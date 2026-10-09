import type { MotionShortformJob } from "./motionContracts";
import { motionFrameLayout } from "../narrationMotion/frameLayout";
import { NarrationError } from "../narration/persistence";
export function filterPath(path: string) {
  if (/[\r\n'\\]/.test(path)) throw new NarrationError("자막 렌더 경로에 지원하지 않는 문자가 있습니다.", 409);
  return path.replace(/:/g, "\\:");
}
export function buildMotionShortformArgs(input: { job: Pick<MotionShortformJob, "plan" | "timeline"> & { renderConfig: Pick<MotionShortformJob["renderConfig"], "preset" | "crf"> }; videos: string[]; audio: string[]; assPath: string; fontDirectory: string; outputPath: string }) {
  const { job } = input; const count = job.plan.scenes.length; const layout = motionFrameLayout(job.plan);
  if (input.videos.length !== count || input.audio.length !== count) throw new NarrationError("각 장면에 승인된 모션과 음성 하나가 필요합니다.");
  const args = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
  for (const video of input.videos) args.push("-i", video);
  for (const audio of input.audio) args.push("-i", audio);
  const filters = layout.map((frame, i) => `[${i}:v]setsar=1,trim=start_frame=0:end_frame=${frame.endFrame - frame.startFrame},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
  filters.push(`${layout.map((_, i) => `[v${i}]`).join("")}concat=n=${count}:v=1:a=0[vjoined]`);
  filters.push(`[vjoined]ass=filename='${filterPath(input.assPath)}':fontsdir='${filterPath(input.fontDirectory)}'[vout]`);
  for (const [i, s] of job.timeline.segments.entries()) filters.push(`[${count + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${(s.durationMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS,adelay=${s.startMs}|${s.startMs}[a${i}]`);
  const total = (job.timeline.totalDurationMs / 1000).toFixed(3);
  const audio = job.timeline.segments.map((_, i) => `[a${i}]`).join("");
  filters.push(count === 1 ? `[a0]atrim=0:${total},asetpts=PTS-STARTPTS[aout]` : `${audio}amix=inputs=${count}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${total},asetpts=PTS-STARTPTS[aout]`);
  args.push("-filter_complex_threads", "1", "-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-threads", "4", "-preset", job.renderConfig.preset, "-crf", String(job.renderConfig.crf), "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-t", total, "-f", "mp4", input.outputPath);
  return args;
}
