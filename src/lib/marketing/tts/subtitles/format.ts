import { TtsError } from "@/lib/marketing/tts/errors";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

export function formatSrtTimestamp(ms: number): string {
  if (typeof ms !== "number" || !Number.isInteger(ms) || !Number.isSafeInteger(ms) || ms < 0) {
    throw new TtsError("invalid_timeline", "SRT timestamp requires a non-negative safe integer millisecond value");
  }
  const hours = Math.trunc(ms / MS_PER_HOUR);
  const afterHours = ms - hours * MS_PER_HOUR;
  const minutes = Math.trunc(afterHours / MS_PER_MINUTE);
  const afterMinutes = afterHours - minutes * MS_PER_MINUTE;
  const seconds = Math.trunc(afterMinutes / MS_PER_SECOND);
  const millis = afterMinutes - seconds * MS_PER_SECOND;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
