import { z } from "zod";

import { TTS_AUTHORITATIVE_CLOCK } from "@/lib/marketing/tts/duration/probe";
import { TTS_INTER_SEGMENT_PAUSE_MS, TTS_MAX_NARRATION_SEGMENTS } from "@/lib/marketing/tts/timeline/contracts";

export const AI_VIDEO_SHOT_LIST_CONTRACT = "ai-video-shot-list-v1" as const;
export const AI_VIDEO_ASPECT_RATIO = "9:16" as const;
export const AI_VIDEO_TIMING_SOURCE = "reel/timeline.json" as const;
export const AI_VIDEO_TRANSITION_HINT = "cut" as const;
export const AI_VIDEO_CONTINUITY_GROUP = "primary" as const;

const boundedString = (max: number) => z.string().max(max);

export const aiVideoShotSchema = z
  .object({
    shotId: boundedString(64),
    ordinal: z.number().int().min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    narrationSegmentId: boundedString(64),
    narrationText: boundedString(4096),
    purpose: boundedString(128),
    visualIntent: boundedString(400),
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    endMs: z.number().int().positive(),
    promptRelativePath: boundedString(200),
    transitionHint: z.literal(AI_VIDEO_TRANSITION_HINT),
    continuityGroup: z.literal(AI_VIDEO_CONTINUITY_GROUP),
  })
  .strict();

export const aiVideoShotListSchema = z
  .object({
    contract: z.literal(AI_VIDEO_SHOT_LIST_CONTRACT),
    candidateId: boundedString(128),
    aspectRatio: z.literal(AI_VIDEO_ASPECT_RATIO),
    timingSource: z.literal(AI_VIDEO_TIMING_SOURCE),
    authoritativeClock: z.literal(TTS_AUTHORITATIVE_CLOCK),
    pauseMs: z.literal(TTS_INTER_SEGMENT_PAUSE_MS),
    shots: z.array(aiVideoShotSchema).min(1).max(TTS_MAX_NARRATION_SEGMENTS),
  })
  .strict();

export type AiVideoShot = z.infer<typeof aiVideoShotSchema>;
export type AiVideoShotList = z.infer<typeof aiVideoShotListSchema>;
