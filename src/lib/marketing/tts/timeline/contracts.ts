import { z } from "zod";

import { TTS_AUTHORITATIVE_CLOCK } from "@/lib/marketing/tts/duration/probe";

export { TTS_AUTHORITATIVE_CLOCK };
export const AUDIO_MASTER_TIMELINE_CONTRACT = "audio-master-timeline-v1" as const;
export const TTS_INTER_SEGMENT_PAUSE_MS = 250;
export const TTS_TRAILING_PAUSE_MS = 0;
export const TTS_TIMELINE_RELATIVE_PATH = "reel/timeline.json";
export const TTS_MAX_NARRATION_SEGMENTS = 16;

const boundedString = (max: number) => z.string().max(max);

export const audioMasterTimelineSegmentSchema = z
  .object({
    segmentId: boundedString(64),
    ordinal: z.number().int().min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    text: boundedString(4096),
    relativeAudioPath: boundedString(200),
    relativeGenerationPath: boundedString(200),
    audioSha256: z.string().length(64),
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    endMs: z.number().int().positive(),
  })
  .strict();

export const audioMasterTimelineSchema = z
  .object({
    contract: z.literal(AUDIO_MASTER_TIMELINE_CONTRACT),
    candidateId: boundedString(128),
    profileId: boundedString(64),
    authoritativeClock: z.literal(TTS_AUTHORITATIVE_CLOCK),
    pauseMs: z.literal(TTS_INTER_SEGMENT_PAUSE_MS),
    trailingPauseMs: z.literal(TTS_TRAILING_PAUSE_MS),
    segments: z.array(audioMasterTimelineSegmentSchema).min(1).max(TTS_MAX_NARRATION_SEGMENTS),
    totalDurationMs: z.number().int().positive(),
    generatedAt: boundedString(64),
  })
  .strict();

export type AudioMasterTimelineSegment = z.infer<typeof audioMasterTimelineSegmentSchema>;
export type AudioMasterTimeline = z.infer<typeof audioMasterTimelineSchema>;
