import { z } from "zod";

import { AI_VIDEO_ASPECT_RATIO } from "@/lib/marketing/assets/video/contracts";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { TTS_MAX_NARRATION_SEGMENTS } from "@/lib/marketing/tts/timeline/contracts";

export const VIDEO_CLIP_INTAKE_CONTRACT = "video-clip-intake-v1" as const;
export const VIDEO_CLIP_INTAKE_RELATIVE_PATH = "reel/clip-intake.json" as const;
export const VIDEO_CLIP_INTAKE_MEDIA_TYPE = "application/json" as const;
export const AI_VIDEO_INCOMING_DIRECTORY = "reel/incoming" as const;
export const AI_VIDEO_INCOMING_EXTENSIONS = ["mp4", "mov", "webm", "mkv"] as const;

const boundedString = (max: number) => z.string().max(max);

export const videoClipIntakeClipSchema = z
  .object({
    shotId: boundedString(64),
    ordinal: z.number().int().min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    sourceRelativePath: boundedString(200),
    sourceSha256: z.string().length(64),
    sourceByteSize: z.number().int().positive(),
    codecName: boundedString(64),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sourceDurationMs: z.number().int().positive(),
    targetStartMs: z.number().int().nonnegative(),
    targetEndMs: z.number().int().positive(),
    targetDurationMs: z.number().int().positive(),
    trimRequired: z.boolean(),
    frameRate: boundedString(32).nullable(),
    hasAudio: z.boolean(),
  })
  .strict();

export const videoClipIntakeSchema = z
  .object({
    contract: z.literal(VIDEO_CLIP_INTAKE_CONTRACT),
    candidateId: boundedString(128),
    shotListRelativePath: z.literal(AI_VIDEO_SHOT_LIST_RELATIVE_PATH),
    aspectRatio: z.literal(AI_VIDEO_ASPECT_RATIO),
    complete: z.literal(true),
    clips: z.array(videoClipIntakeClipSchema).min(1).max(TTS_MAX_NARRATION_SEGMENTS),
  })
  .strict();

export type VideoClipIntakeClip = z.infer<typeof videoClipIntakeClipSchema>;
export type VideoClipIntake = z.infer<typeof videoClipIntakeSchema>;
