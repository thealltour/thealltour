import { TtsError } from "@/lib/marketing/tts/errors";
import { TTS_MAX_NARRATION_SEGMENTS } from "@/lib/marketing/tts/timeline/contracts";

export function ttsOrderedSegmentStem(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > TTS_MAX_NARRATION_SEGMENTS) {
    throw new TtsError("invalid_request", "TTS segment ordinal is out of range");
  }
  return `segment-${String(ordinal).padStart(4, "0")}`;
}

export function ttsOrderedSegmentAudioRelativePath(ordinal: number): string {
  return `reel/audio/${ttsOrderedSegmentStem(ordinal)}.wav`;
}

export function ttsOrderedSegmentGenerationRelativePath(ordinal: number): string {
  return `reel/audio/${ttsOrderedSegmentStem(ordinal)}.generation.json`;
}
