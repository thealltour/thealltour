import { TTS_MAX_NARRATION_SEGMENTS } from "@/lib/marketing/tts/timeline/contracts";
import { VideoShotError } from "@/lib/marketing/assets/errors";

export const MEDIA_BRIEF_RELATIVE_PATH = "context/media-brief.json" as const;
export const AI_VIDEO_SHOT_LIST_RELATIVE_PATH = "reel/shot-list.json" as const;
export const AI_VIDEO_PROMPT_PACK_RELATIVE_PATH = "reel/video-prompts.md" as const;
export const AI_VIDEO_SHOT_LIST_MEDIA_TYPE = "application/json" as const;
export const AI_VIDEO_PROMPT_MEDIA_TYPE = "text/plain; charset=utf-8" as const;
export const AI_VIDEO_MARKDOWN_MEDIA_TYPE = "text/markdown; charset=utf-8" as const;

export function aiVideoShotStem(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > TTS_MAX_NARRATION_SEGMENTS) {
    throw new VideoShotError("invalid_shot_list", "Shot ordinal is out of range");
  }
  return `shot-${String(ordinal).padStart(4, "0")}`;
}

export function aiVideoShotPromptRelativePath(ordinal: number): string {
  return `reel/prompts/${aiVideoShotStem(ordinal)}.txt`;
}
