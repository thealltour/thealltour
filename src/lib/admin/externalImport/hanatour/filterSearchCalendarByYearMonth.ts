import type { HanatourCalendarDay } from "@/lib/admin/externalImport/hanatour/types";

import { parseYearMonthFromTitle } from "@/lib/admin/externalImport/hanatour/domScrapedToSearchCalendar";

export function parseVisibleYearMonth(text: string | null | undefined): string | null {
  return parseYearMonthFromTitle(text);
}

export function filterSearchCalendarByYearMonth(
  searchCalendar: Record<string, HanatourCalendarDay[]> | null | undefined,
  yearMonth: string | null | undefined,
): Record<string, HanatourCalendarDay[]> | null {
  if (!searchCalendar || !yearMonth) return searchCalendar ?? null;
  const rows = searchCalendar[yearMonth];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return { [yearMonth]: rows };
}

export function findVisibleYearMonthInDocumentText(text: string): string | null {
  const match = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
  if (!match) return null;
  const month = String(Number(match[2])).padStart(2, "0");
  return `${match[1]}${month}`;
}
