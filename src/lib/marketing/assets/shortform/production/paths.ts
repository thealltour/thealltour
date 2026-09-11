import "server-only";

export const SHORTFORM_FINAL_RELATIVE_PATH = "reel/final/shortform.mp4" as const;
export const SHORTFORM_FINAL_MEDIA_TYPE = "video/mp4" as const;
export const SHORTFORM_FINAL_ARTIFACT_KIND = "reel_video" as const;
export const SHORTFORM_FINAL_ORIGIN = "shortform_video_render" as const;

export const SHORTFORM_OUTPUT_PROFILE_V1 = {
  width: 1080,
  height: 1920,
  fps: 30,
  videoCodec: "h264",
  audioCodec: "aac",
  pixelFormat: "yuv420p",
  encoder: "libx264",
} as const;

export const SHORTFORM_DOWNLOAD_DEFAULTS = {
  timeoutMs: 60_000,
  maxBytes: 120 * 1024 * 1024,
  maxRedirects: 3,
} as const;

export const PEXELS_DOWNLOAD_HOST_ALLOWLIST = [
  "images.pexels.com",
  "videos.pexels.com",
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
] as const;

export const PIXABAY_DOWNLOAD_HOST_ALLOWLIST = [
  "cdn.pixabay.com",
  "i.vimeocdn.com",
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
] as const;
