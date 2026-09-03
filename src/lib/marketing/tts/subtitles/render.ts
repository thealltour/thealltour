import { formatSrtTimestamp } from "@/lib/marketing/tts/subtitles/format";
import { assertTimelineReadyForSubtitles } from "@/lib/marketing/tts/subtitles/validate";
import { TtsError } from "@/lib/marketing/tts/errors";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";

export const TTS_SUBTITLES_RELATIVE_PATH = "reel/subtitles.srt" as const;
export const TTS_SUBTITLES_MEDIA_TYPE = "application/x-subrip" as const;

export function normalizeSrtText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    throw new TtsError("invalid_timeline", "Subtitle text is empty after normalization");
  }
  return normalized;
}

export function renderSrtFromTimeline(timeline: AudioMasterTimeline): string {
  assertTimelineReadyForSubtitles(timeline);
  const cues = timeline.segments.map((segment, index) => {
    const start = formatSrtTimestamp(segment.startMs);
    const end = formatSrtTimestamp(segment.endMs);
    const text = normalizeSrtText(segment.text);
    return `${index + 1}\n${start} --> ${end}\n${text}\n`;
  });
  return `${cues.join("\n")}\n`;
}
