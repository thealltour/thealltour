import { TtsError } from "@/lib/marketing/tts/errors";
import {
  AUDIO_MASTER_TIMELINE_CONTRACT,
  TTS_AUTHORITATIVE_CLOCK,
  TTS_INTER_SEGMENT_PAUSE_MS,
  TTS_TRAILING_PAUSE_MS,
  audioMasterTimelineSchema,
  type AudioMasterTimeline,
  type AudioMasterTimelineSegment,
} from "@/lib/marketing/tts/timeline/contracts";

export type TimelineSegmentMeasurement = {
  segmentId: string;
  ordinal: number;
  text: string;
  relativeAudioPath: string;
  relativeGenerationPath: string;
  audioSha256: string;
  durationMs: number;
};

export function buildAudioMasterTimeline(input: {
  candidateId: string;
  profileId: string;
  segments: TimelineSegmentMeasurement[];
  generatedAt: string;
}): AudioMasterTimeline {
  if (input.segments.length === 0) {
    throw new TtsError("incomplete_narration", "Cannot build a master timeline without measured segments");
  }

  const timed: AudioMasterTimelineSegment[] = [];
  let cursorMs = 0;
  for (const [index, segment] of input.segments.entries()) {
    if (index > 0) {
      cursorMs += TTS_INTER_SEGMENT_PAUSE_MS;
    }
    const startMs = cursorMs;
    const endMs = startMs + segment.durationMs;
    timed.push({
      segmentId: segment.segmentId,
      ordinal: segment.ordinal,
      text: segment.text,
      relativeAudioPath: segment.relativeAudioPath,
      relativeGenerationPath: segment.relativeGenerationPath,
      audioSha256: segment.audioSha256,
      startMs,
      durationMs: segment.durationMs,
      endMs,
    });
    cursorMs = endMs;
  }

  const last = timed[timed.length - 1];
  const parsed = audioMasterTimelineSchema.safeParse({
    contract: AUDIO_MASTER_TIMELINE_CONTRACT,
    candidateId: input.candidateId,
    profileId: input.profileId,
    authoritativeClock: TTS_AUTHORITATIVE_CLOCK,
    pauseMs: TTS_INTER_SEGMENT_PAUSE_MS,
    trailingPauseMs: TTS_TRAILING_PAUSE_MS,
    segments: timed,
    totalDurationMs: last.endMs,
    generatedAt: input.generatedAt,
  });
  if (!parsed.success) {
    throw new TtsError("invalid_request", "audio-master-timeline-v1 contract is invalid");
  }
  return parsed.data;
}
