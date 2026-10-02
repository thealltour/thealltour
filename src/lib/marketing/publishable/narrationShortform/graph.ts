import type { NarrationShortformJob } from "./contracts";
import { SHORTFORM_RENDER_CONFIG } from "./contracts";
import { NarrationError } from "../narration/persistence";
export function buildNarrationShortformArgs(input: { job: NarrationShortformJob; images: string[]; audio: string[]; subtitlesPath: string; outputPath: string }) {
  const { job } = input; const count = job.plan.scenes.length;
  if (input.images.length !== count || input.audio.length !== count) throw new NarrationError("각 장면에 이미지·음성 하나가 필요합니다.");
  const args = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
  for (const image of input.images) args.push("-loop", "1", "-framerate", "30", "-i", image);
  for (const audio of input.audio) args.push("-i", audio);
  args.push("-i", input.subtitlesPath);
  const filters: string[] = [];
  let previousFrame = 0;
  for (const [i, scene] of job.plan.scenes.entries()) {
    // Round cumulative boundaries, not each scene duration: rounding error cannot accumulate.
    const finalFrame = i === count - 1 ? Math.ceil(scene.sceneEndMs * 30 / 1000) : Math.round(scene.sceneEndMs * 30 / 1000);
    const frames = finalFrame - previousFrame;
    if (frames < 1) throw new NarrationError("30fps에서 표현할 수 없는 장면 구간입니다. 자동 병합하지 않습니다.");
    previousFrame = finalFrame;
    filters.push(`[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,trim=start_frame=0:end_frame=${frames},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
  }
  filters.push(`${job.plan.scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${count}:v=1:a=0,fps=30[vout]`);
  for (const [i, segment] of job.timeline.segments.entries()) {
    const seconds = (segment.durationMs / 1000).toFixed(3);
    filters.push(`[${count + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${seconds},asetpts=PTS-STARTPTS,adelay=${segment.startMs}|${segment.startMs}[a${i}]`);
  }
  const total = (job.timeline.totalDurationMs / 1000).toFixed(3);
  const audioInputs = job.timeline.segments.map((_, i) => `[a${i}]`).join("");
  filters.push(count === 1 ? `[a0]atrim=0:${total},asetpts=PTS-STARTPTS[aout]` :
    `${audioInputs}amix=inputs=${count}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${total},asetpts=PTS-STARTPTS[aout]`);
  args.push("-filter_complex_threads", "1", "-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]", "-map", `${count * 2}:0`,
    "-c:v", SHORTFORM_RENDER_CONFIG.videoCodec, "-preset", SHORTFORM_RENDER_CONFIG.preset, "-crf", String(SHORTFORM_RENDER_CONFIG.crf),
    "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-c:s", "mov_text",
    "-movflags", "+faststart", "-t", total, "-f", "mp4", input.outputPath);
  return args;
}
