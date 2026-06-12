import type { Matcher } from "react-day-picker";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ymdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd || !ISO_DATE_RE.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return undefined;
  }
  return date;
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
