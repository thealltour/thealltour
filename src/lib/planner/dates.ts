import type { PlannerDateMode, PlannerDraftInput } from "@/types/planner";

export const PLANNER_DURATION_DAYS_MIN = 2;
export const PLANNER_DURATION_DAYS_MAX = 30;

export function isIsoDateYmd(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function computeDurationDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number | null {
  if (!isIsoDateYmd(startDate) || !isIsoDateYmd(endDate)) return null;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function draftTripDurationDays(draft: Pick<PlannerDraftInput, "dates">): number {
  if (draft.dates.mode === "flexible") {
    return draft.dates.durationDays;
  }
  const computed = computeDurationDays(draft.dates.startDate, draft.dates.endDate);
  if (computed != null) return computed;
  return draft.dates.durationDays;
}

export function formatIsoDateDot(ymd: string | null | undefined): string {
  if (!isIsoDateYmd(ymd)) return "";
  const [y, m, d] = ymd.split("-");
  return `${y}.${m}.${d}`;
}

/** Wizard / summary label for the selected date mode. */
export function formatPlannerDatesSummary(dates: PlannerDraftInput["dates"]): string {
  if (dates.mode === "flexible") {
    return `${dates.durationDays}일 여행`;
  }
  if (!isIsoDateYmd(dates.startDate) || !isIsoDateYmd(dates.endDate)) {
    return "날짜를 선택해 주세요";
  }
  const days = computeDurationDays(dates.startDate, dates.endDate) ?? dates.durationDays;
  const nights = Math.max(0, days - 1);
  return `${formatIsoDateDot(dates.startDate)} → ${formatIsoDateDot(dates.endDate)} / ${nights}박 ${days}일`;
}

export function inferDateMode(dates: {
  mode?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}): PlannerDateMode {
  if (dates.mode === "flexible" || dates.mode === "fixed") return dates.mode;
  if (isIsoDateYmd(typeof dates.startDate === "string" ? dates.startDate : null)) {
    return "fixed";
  }
  return "fixed";
}
