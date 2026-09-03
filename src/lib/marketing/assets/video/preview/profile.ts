export const VIDEO_PREVIEW_WIDTH = 720;
export const VIDEO_PREVIEW_HEIGHT = 1280;
export const VIDEO_PREVIEW_FPS = 30;
export const VIDEO_PREVIEW_PIXEL_FORMAT = "yuv420p";
export const VIDEO_PREVIEW_VIDEO_CODEC = "libx264";
export const VIDEO_PREVIEW_VIDEO_CODEC_NAME = "h264";
export const VIDEO_PREVIEW_PRESET = "veryfast";
export const VIDEO_PREVIEW_CRF = 23;
export const VIDEO_PREVIEW_AUDIO_CODEC = "aac";
export const VIDEO_PREVIEW_AUDIO_SAMPLE_RATE = 48_000;
export const VIDEO_PREVIEW_AUDIO_CHANNELS = 2;
export const VIDEO_PREVIEW_GAP_POLICY = "hold_previous_frame" as const;
export const VIDEO_PREVIEW_SUBTITLE_MODE = "soft_track" as const;
export const VIDEO_PREVIEW_SUBTITLE_CODEC = "mov_text";

/**
 * One 30fps preview frame is 1000/30 ≈ 33.33ms.
 * Output-container QA uses ceil(1000/fps) so a single muxed frame is always in range.
 * This tolerance never rewrites timeline/shot-list/SRT.
 */
export const VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS = Math.ceil(1000 / VIDEO_PREVIEW_FPS);

export const VIDEO_PREVIEW_PROFILE = {
  width: VIDEO_PREVIEW_WIDTH,
  height: VIDEO_PREVIEW_HEIGHT,
  fps: VIDEO_PREVIEW_FPS,
  pixelFormat: VIDEO_PREVIEW_PIXEL_FORMAT,
  videoCodec: VIDEO_PREVIEW_VIDEO_CODEC,
  audioCodec: VIDEO_PREVIEW_AUDIO_CODEC,
  audioSampleRate: VIDEO_PREVIEW_AUDIO_SAMPLE_RATE,
  gapPolicy: VIDEO_PREVIEW_GAP_POLICY,
  subtitleMode: VIDEO_PREVIEW_SUBTITLE_MODE,
} as const;

export function msToFfmpegSeconds(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new Error("Preview timing must be a non-negative integer millisecond value");
  }
  return (ms / 1000).toFixed(3);
}

export function isCompatiblePreviewFps(rate: string | null): boolean {
  if (!rate) return false;
  const trimmed = rate.trim();
  if (trimmed === "30" || trimmed === "30.0" || trimmed === "30/1") return true;
  const match = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (!match || Number(match[2]) === 0) return false;
  return Math.abs(Number(match[1]) / Number(match[2]) - VIDEO_PREVIEW_FPS) < 0.05;
}
