import {
  VIDEO_PREVIEW_AUDIO_CHANNELS,
  VIDEO_PREVIEW_AUDIO_CODEC,
  VIDEO_PREVIEW_AUDIO_SAMPLE_RATE,
  VIDEO_PREVIEW_CRF,
  VIDEO_PREVIEW_PIXEL_FORMAT,
  VIDEO_PREVIEW_PRESET,
  VIDEO_PREVIEW_PROFILE,
  VIDEO_PREVIEW_SUBTITLE_CODEC,
  VIDEO_PREVIEW_VIDEO_CODEC,
  msToFfmpegSeconds,
} from "@/lib/marketing/assets/video/preview/profile";

export type PreviewGraphShot = {
  absolutePath: string;
  targetStartMs: number;
  targetDurationMs: number;
  gapAfterMs: number;
};

export type PreviewGraphNarration = {
  absolutePath: string;
  startMs: number;
  durationMs: number;
};

export type PreviewFfmpegGraph = {
  args: string[];
  filterComplex: string;
  videoInputCount: number;
  audioInputCount: number;
  subtitleInputIndex: number;
};

export function buildPreviewFilterComplex(input: {
  shots: Array<{ targetStartMs: number; targetDurationMs: number; gapAfterMs: number }>;
  narration: Array<{ startMs: number; durationMs: number }>;
  totalDurationMs: number;
}): string {
  const videoChains: string[] = [];
  for (const [index, shot] of input.shots.entries()) {
    let chain = `[${index}:v]trim=start=0:duration=${msToFfmpegSeconds(shot.targetDurationMs)},setpts=PTS-STARTPTS,scale=${VIDEO_PREVIEW_PROFILE.width}:${VIDEO_PREVIEW_PROFILE.height}:force_original_aspect_ratio=decrease,pad=${VIDEO_PREVIEW_PROFILE.width}:${VIDEO_PREVIEW_PROFILE.height}:(ow-iw)/2:(oh-ih)/2:black,fps=${VIDEO_PREVIEW_PROFILE.fps},format=${VIDEO_PREVIEW_PIXEL_FORMAT},setsar=1`;
    if (index === 0 && shot.targetStartMs > 0) {
      chain += `,tpad=start_mode=add:start_duration=${msToFfmpegSeconds(shot.targetStartMs)}:color=black`;
    }
    if (shot.gapAfterMs > 0) {
      chain += `,tpad=stop_mode=clone:stop_duration=${msToFfmpegSeconds(shot.gapAfterMs)}`;
    }
    chain += `[v${index}]`;
    videoChains.push(chain);
  }

  const concatInput = input.shots.map((_, index) => `[v${index}]`).join("");
  const concat = `${concatInput}concat=n=${input.shots.length}:v=1:a=0[vout]`;

  const audioOffset = input.shots.length;
  const audioChains: string[] = [];
  for (const [index, segment] of input.narration.entries()) {
    const duration = msToFfmpegSeconds(segment.durationMs);
    audioChains.push(
      `[${audioOffset + index}:a]aformat=sample_rates=${VIDEO_PREVIEW_AUDIO_SAMPLE_RATE}:channel_layouts=stereo,atrim=0:${duration},asetpts=PTS-STARTPTS,apad=whole_dur=${duration},adelay=${segment.startMs}|${segment.startMs}[a${index}]`,
    );
  }

  const total = msToFfmpegSeconds(input.totalDurationMs);
  const mixed =
    input.narration.length === 1
      ? `[a0]atrim=0:${total},asetpts=PTS-STARTPTS[aout]`
      : `${input.narration.map((_, index) => `[a${index}]`).join("")}amix=inputs=${input.narration.length}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${total},asetpts=PTS-STARTPTS[aout]`;

  return [...videoChains, concat, ...audioChains, mixed].join(";");
}

export function buildPreviewFfmpegArgs(input: {
  shots: PreviewGraphShot[];
  narration: PreviewGraphNarration[];
  subtitlesAbsolutePath: string;
  outputAbsolutePath: string;
  totalDurationMs: number;
}): PreviewFfmpegGraph {
  const filterComplex = buildPreviewFilterComplex({
    shots: input.shots,
    narration: input.narration,
    totalDurationMs: input.totalDurationMs,
  });
  const args: string[] = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
  for (const shot of input.shots) {
    args.push("-i", shot.absolutePath);
  }
  for (const segment of input.narration) {
    args.push("-i", segment.absolutePath);
  }
  const subtitleInputIndex = input.shots.length + input.narration.length;
  args.push(
    "-i",
    input.subtitlesAbsolutePath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-map",
    `${subtitleInputIndex}:0`,
    "-c:v",
    VIDEO_PREVIEW_VIDEO_CODEC,
    "-preset",
    VIDEO_PREVIEW_PRESET,
    "-crf",
    String(VIDEO_PREVIEW_CRF),
    "-pix_fmt",
    VIDEO_PREVIEW_PIXEL_FORMAT,
    "-r",
    String(VIDEO_PREVIEW_PROFILE.fps),
    "-c:a",
    VIDEO_PREVIEW_AUDIO_CODEC,
    "-ar",
    String(VIDEO_PREVIEW_AUDIO_SAMPLE_RATE),
    "-ac",
    String(VIDEO_PREVIEW_AUDIO_CHANNELS),
    "-c:s",
    VIDEO_PREVIEW_SUBTITLE_CODEC,
    "-f",
    "mp4",
    "-t",
    msToFfmpegSeconds(input.totalDurationMs),
    input.outputAbsolutePath,
  );

  return {
    args,
    filterComplex,
    videoInputCount: input.shots.length,
    audioInputCount: input.narration.length,
    subtitleInputIndex,
  };
}
