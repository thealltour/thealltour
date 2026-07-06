/** 하나투어 달력 safe-nav 순수 함수 (익스텐션 openHanatourCalendar.js와 동기화) */

export const MIN_DAY_STRIP_CELLS = 2;
export const STRIP_PAGING_SKIP_MIN_DAYS = 5;

export function isProductDetailHref(href: string | null | undefined): boolean {
  const h = String(href ?? "").toLowerCase();
  if (!h || h === "#" || h === "#none") return false;
  if (h.includes("/trp/pkg")) return true;
  return /pkgcd=|pkgprodcd=|depday=/.test(h);
}

export function hasEnoughDayStripCells(dayCount: number): boolean {
  return dayCount >= MIN_DAY_STRIP_CELLS;
}

export function nextYearMonth(yearMonth: string): string | null {
  if (!yearMonth || !/^\d{6}$/.test(yearMonth)) return null;
  const y = Number(yearMonth.slice(0, 4));
  const m = Number(yearMonth.slice(4, 6));
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function hasMonthInCalendar(
  searchCalendar: Record<string, unknown> | null | undefined,
  yearMonth: string,
): boolean {
  if (!yearMonth || !searchCalendar) return false;
  const rows = searchCalendar[yearMonth];
  return Array.isArray(rows) && rows.length > 0;
}

export function getCalendarMonthKeys(
  searchCalendar: Record<string, unknown> | null | undefined,
): string[] {
  if (!searchCalendar || typeof searchCalendar !== "object") return [];
  return Object.keys(searchCalendar)
    .filter(
      (k) =>
        /^\d{6}$/.test(k) &&
        Array.isArray(searchCalendar[k]) &&
        (searchCalendar[k] as unknown[]).length > 0,
    )
    .sort();
}

export function shouldSkipStripPaging(daysInMonth: number): boolean {
  return daysInMonth >= STRIP_PAGING_SKIP_MIN_DAYS;
}
