import { MINUTE_WINDOW_MS, RUNTIME_QUOTA_TIMEZONE } from "@/ai-runtime/quota/constants";

const SEOUL_OFFSET = "+09:00";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Start of the current calendar day in Asia/Seoul, as a UTC Date. */
export function getSeoulCalendarDayStart(now: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: RUNTIME_QUOTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00.000${SEOUL_OFFSET}`);
}

export function getSeoulCalendarDayEnd(dayStart: Date): Date {
  return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
}

export function isWithinRollingMinute(completedAt: string, now: Date): boolean {
  const completedMs = Date.parse(completedAt);
  if (Number.isNaN(completedMs)) return false;
  return completedMs >= now.getTime() - MINUTE_WINDOW_MS && completedMs <= now.getTime();
}

/** True when event falls in the current Asia/Seoul calendar day. */
export function isWithinSeoulCalendarDay(completedAt: string, now: Date): boolean {
  const completedMs = Date.parse(completedAt);
  if (Number.isNaN(completedMs)) return false;
  const dayStart = getSeoulCalendarDayStart(now);
  const dayEnd = getSeoulCalendarDayEnd(dayStart);
  return completedMs >= dayStart.getTime() && completedMs < dayEnd.getTime();
}
