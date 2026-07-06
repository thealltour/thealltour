import type { HanatourCalendarDay } from "@/lib/admin/externalImport/hanatour/types";

export type DomScrapedCalendarRow = {
  /** 일(1–31) */
  day: number | string;
  /** 예: "151만", "1,569,900" */
  priceText: string;
  /** YYYYMM */
  yearMonth: string;
};

export function parseYearMonthFromTitle(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{4})\D*(\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const month = String(Number(match[2])).padStart(2, "0");
  return `${year}${month}`;
}

export function domScrapedRowsToSearchCalendar(
  rows: DomScrapedCalendarRow[],
): Record<string, HanatourCalendarDay[]> {
  const searchCalendar: Record<string, HanatourCalendarDay[]> = {};

  for (const row of rows) {
    const ym = row.yearMonth?.trim();
    const priceText = row.priceText?.trim();
    if (!ym || !/^\d{6}$/.test(ym) || !priceText || priceText === "-") continue;

    const dayNum =
      typeof row.day === "number" ? row.day : Number.parseInt(String(row.day).trim(), 10);
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) continue;

    const year = ym.slice(0, 4);
    const month = ym.slice(4, 6);
    const dayStr = String(dayNum).padStart(2, "0");
    const depDay = `${year}${month}${dayStr}`;

    if (!searchCalendar[ym]) searchCalendar[ym] = [];
    searchCalendar[ym].push({
      depDay,
      depDayNm: `${month}.${dayStr}`,
      adtAmt: priceText,
    });
  }

  return searchCalendar;
}

export function countSearchCalendarDays(
  searchCalendar: Record<string, HanatourCalendarDay[]> | undefined,
): number {
  if (!searchCalendar) return 0;
  return Object.values(searchCalendar).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
}
