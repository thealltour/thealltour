import {
  AUDIO_MASTER_TIMELINE_CONTRACT,
  audioMasterTimelineSchema,
  type AudioMasterTimeline,
} from "@/lib/marketing/tts/timeline/contracts";
import { TtsError } from "@/lib/marketing/tts/errors";

export function parseAudioMasterTimeline(value: unknown): AudioMasterTimeline {
  if (typeof value === "object" && value !== null && "contract" in value) {
    const contract = (value as { contract: unknown }).contract;
    if (contract !== AUDIO_MASTER_TIMELINE_CONTRACT) {
      throw new TtsError("unsupported_timeline", "Timeline contract must be audio-master-timeline-v1");
    }
  }
  const parsed = audioMasterTimelineSchema.safeParse(value);
  if (!parsed.success) {
    throw new TtsError("invalid_timeline", "audio-master-timeline-v1 is malformed");
  }
  return parsed.data;
}

export function assertTimelineReadyForSubtitles(timeline: AudioMasterTimeline): void {
  if (timeline.segments.length === 0) {
    throw new TtsError("invalid_timeline", "Timeline has no segments");
  }

  let previousEndMs = 0;
  let previousStartMs = -1;
  for (const [index, segment] of timeline.segments.entries()) {
    const expectedOrdinal = index + 1;
    if (segment.ordinal !== expectedOrdinal) {
      throw new TtsError("invalid_timeline", "Timeline ordinals must match segment order");
    }
    if (segment.startMs < 0 || !Number.isInteger(segment.startMs)) {
      throw new TtsError("invalid_timeline", "Segment startMs must be a non-negative integer");
    }
    if (segment.durationMs <= 0 || !Number.isInteger(segment.durationMs)) {
      throw new TtsError("invalid_timeline", "Segment durationMs must be a positive integer");
    }
    if (segment.endMs <= segment.startMs) {
      throw new TtsError("invalid_timeline", "Segment endMs must be greater than startMs");
    }
    if (segment.endMs !== segment.startMs + segment.durationMs) {
      throw new TtsError("invalid_timeline", "Segment endMs must equal startMs + durationMs");
    }
    if (index > 0 && segment.startMs <= previousStartMs) {
      throw new TtsError("invalid_timeline", "Segment start times must be strictly increasing");
    }
    if (index > 0 && segment.startMs < previousEndMs) {
      throw new TtsError("invalid_timeline", "Subtitle cues must not overlap");
    }
    previousEndMs = segment.endMs;
    previousStartMs = segment.startMs;
  }
}
