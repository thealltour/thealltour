import { TtsError } from "@/lib/marketing/tts/errors";

export const TTS_AUTHORITATIVE_CLOCK = "persisted_wav_ffprobe" as const;
export type TtsAuthoritativeClock = typeof TTS_AUTHORITATIVE_CLOCK;

export const DEFAULT_FFPROBE_TIMEOUT_MS = 10_000;
export const DEFAULT_FFPROBE_BINARY = "ffprobe";

export type PersistedWavDuration = {
  durationMs: number;
  source: TtsAuthoritativeClock;
  absolutePath: string;
};

export type AudioDurationProbe = {
  probePersistedWav(absolutePath: string): Promise<PersistedWavDuration>;
};

export function durationSecondsToMs(seconds: number): number {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    throw new TtsError("invalid_duration", "ffprobe duration must be a finite number greater than zero");
  }
  const durationMs = Math.round(seconds * 1000);
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new TtsError("invalid_duration", "ffprobe duration must convert to a positive integer millisecond value");
  }
  return durationMs;
}

export function parseFfprobeDurationJson(stdout: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new TtsError("invalid_duration", "ffprobe output is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new TtsError("invalid_duration", "ffprobe JSON is malformed");
  }
  const format = (parsed as { format?: unknown }).format;
  if (typeof format !== "object" || format === null) {
    throw new TtsError("invalid_duration", "ffprobe JSON is missing format.duration");
  }
  const raw = (format as { duration?: unknown }).duration;
  if (raw == null || raw === "") {
    throw new TtsError("invalid_duration", "ffprobe JSON is missing format.duration");
  }
  const seconds = typeof raw === "number" ? raw : Number(raw);
  return durationSecondsToMs(seconds);
}
