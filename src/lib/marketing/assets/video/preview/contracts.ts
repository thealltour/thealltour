import { z } from "zod";

import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { VIDEO_CLIP_INTAKE_RELATIVE_PATH } from "@/lib/marketing/assets/video/intake/contracts";
import {
  VIDEO_PREVIEW_AUDIO_CODEC,
  VIDEO_PREVIEW_AUDIO_SAMPLE_RATE,
  VIDEO_PREVIEW_FPS,
  VIDEO_PREVIEW_GAP_POLICY,
  VIDEO_PREVIEW_HEIGHT,
  VIDEO_PREVIEW_SUBTITLE_MODE,
  VIDEO_PREVIEW_VIDEO_CODEC,
  VIDEO_PREVIEW_WIDTH,
} from "@/lib/marketing/assets/video/preview/profile";
import { TTS_MAX_NARRATION_SEGMENTS, TTS_TIMELINE_RELATIVE_PATH } from "@/lib/marketing/tts/timeline/contracts";
import { TTS_SUBTITLES_RELATIVE_PATH } from "@/lib/marketing/tts/subtitles/render";

export const VIDEO_PREVIEW_COMPOSITION_CONTRACT = "video-preview-composition-v1" as const;
export const VIDEO_PREVIEW_RELATIVE_PATH = "reel/preview/preview.mp4" as const;
export const VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH = "reel/preview/composition.json" as const;
export const VIDEO_PREVIEW_MEDIA_TYPE = "video/mp4" as const;
export const VIDEO_PREVIEW_COMPOSITION_MEDIA_TYPE = "application/json" as const;

const boundedString = (max: number) => z.string().max(max);

export const videoPreviewProfileSchema = z
  .object({
    width: z.literal(VIDEO_PREVIEW_WIDTH),
    height: z.literal(VIDEO_PREVIEW_HEIGHT),
    fps: z.literal(VIDEO_PREVIEW_FPS),
    videoCodec: z.literal(VIDEO_PREVIEW_VIDEO_CODEC),
    audioCodec: z.literal(VIDEO_PREVIEW_AUDIO_CODEC),
    audioSampleRate: z.literal(VIDEO_PREVIEW_AUDIO_SAMPLE_RATE),
    gapPolicy: z.literal(VIDEO_PREVIEW_GAP_POLICY),
    subtitleMode: z.literal(VIDEO_PREVIEW_SUBTITLE_MODE),
  })
  .strict();

export const videoPreviewSourceSchema = z
  .object({
    shotId: boundedString(64),
    sourceRelativePath: boundedString(200),
    sourceSha256: z.string().length(64),
    targetStartMs: z.number().int().nonnegative(),
    targetEndMs: z.number().int().positive(),
    targetDurationMs: z.number().int().positive(),
  })
  .strict();

export const videoPreviewNarrationSchema = z
  .object({
    segmentId: boundedString(64),
    relativeAudioPath: boundedString(200),
    audioSha256: z.string().length(64),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    durationMs: z.number().int().positive(),
  })
  .strict();

export const videoPreviewCompositionSchema = z
  .object({
    contract: z.literal(VIDEO_PREVIEW_COMPOSITION_CONTRACT),
    candidateId: boundedString(128),
    timelineRelativePath: z.literal(TTS_TIMELINE_RELATIVE_PATH),
    shotListRelativePath: z.literal(AI_VIDEO_SHOT_LIST_RELATIVE_PATH),
    clipIntakeRelativePath: z.literal(VIDEO_CLIP_INTAKE_RELATIVE_PATH),
    subtitlesRelativePath: z.literal(TTS_SUBTITLES_RELATIVE_PATH),
    previewRelativePath: z.literal(VIDEO_PREVIEW_RELATIVE_PATH),
    totalDurationMs: z.number().int().positive(),
    profile: videoPreviewProfileSchema,
    sources: z.array(videoPreviewSourceSchema).min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    narration: z.array(videoPreviewNarrationSchema).min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    previewSha256: z.string().length(64),
    previewByteSize: z.number().int().positive(),
  })
  .strict();

export type VideoPreviewProfile = z.infer<typeof videoPreviewProfileSchema>;
export type VideoPreviewSource = z.infer<typeof videoPreviewSourceSchema>;
export type VideoPreviewNarration = z.infer<typeof videoPreviewNarrationSchema>;
export type VideoPreviewComposition = z.infer<typeof videoPreviewCompositionSchema>;
