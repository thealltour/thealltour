import type { Matcher } from "react-day-picker";
import { parseIsoDateYmd } from "@/lib/datetime/isoDate";

export function ymdToDate(ymd: string | null | undefined): Date | undefined {
  return parseIsoDateYmd(ymd);
}

export function dateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildDisabledMatcher(min?: string, max?: string): Matcher | Matcher[] | undefined {
  const matchers: Matcher[] = [];
  const minDate = ymdToDate(min);
  const maxDate = ymdToDate(max);
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });
  if (matchers.length === 0) return undefined;
  if (matchers.length === 1) return matchers[0];
  return matchers;
}

/** Planner keepOpenAfterStart: first click may mirror from===to; treat as incomplete. */
export function isDateRangeSelectionComplete(
  from: string,
  to: string,
  keepOpenAfterStart: boolean,
): boolean {
  if (!from || !to) return false;
  if (keepOpenAfterStart && from === to) return false;
  return true;
}
