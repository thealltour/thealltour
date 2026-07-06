import type { HanatourCalendarDataRow, HanatourCalendarDay, HanatourCalendarPayload } from "./types";

export const API_BASE = "https://m.hanatour.com/api/v1/product/calendar";
export const DEFAULT_MONTH_COUNT = 12;
export const MIN_DAYS_FOR_SUFFICIENT = 5;
export const MIN_MONTHS_FOR_SUFFICIENT = 2;

export type HanatourCalendarMeta = {
  saleProdCd?: string | null;
  rprsProdCd?: string | null;
  depDay?: string | null;
};

export type MonthApiUrlCandidate = {
  url: string;
  codeType: string;
};

export function buildYearMonthList(count: number, startDate?: Date): string[] {
  const out: string[] = [];
  const cursor = startDate ? new Date(startDate) : new Date();
  for (let i = 0; i < count; i += 1) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    out.push(`${year}${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

export function countCalendarDays(
  searchCalendar: Record<string, HanatourCalendarDay[]> | undefined,
): number {
  if (!searchCalendar) return 0;
  return Object.values(searchCalendar).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
}

export function countCalendarMonths(
  searchCalendar: Record<string, HanatourCalendarDay[]> | undefined,
): number {
  if (!searchCalendar) return 0;
  return Object.values(searchCalendar).filter((rows) => (rows?.length ?? 0) > 0).length;
}

export function isCalendarSufficient(
  result: Pick<HanatourCalendarPayload, "searchCalendar" | "calendarData"> | null | undefined,
): boolean {
  if (!result) return false;
  const days = countCalendarDays(result.searchCalendar);
  const months = countCalendarMonths(result.searchCalendar);
  if (days >= MIN_DAYS_FOR_SUFFICIENT || months >= MIN_MONTHS_FOR_SUFFICIENT) {
    return true;
  }
  return (result.calendarData?.length ?? 0) >= MIN_DAYS_FOR_SUFFICIENT;
}

export function buildMonthApiUrls(meta: HanatourCalendarMeta, yearMonth: string): MonthApiUrlCandidate[] {
  const urls: MonthApiUrlCandidate[] = [];
  const rprs = meta.rprsProdCd?.trim();
  const sale = meta.saleProdCd?.trim();

  if (rprs) {
    urls.push({
      url: `${API_BASE}?rprsProdCd=${encodeURIComponent(rprs)}&yearMonth=${yearMonth}`,
      codeType: "rprsProdCd",
    });
    urls.push({
      url: `${API_BASE}?prodCode=${encodeURIComponent(rprs)}&yearMonth=${yearMonth}`,
      codeType: "prodCode_rprs",
    });
  }
  if (sale) {
    urls.push({
      url: `${API_BASE}?saleProdCd=${encodeURIComponent(sale)}&yearMonth=${yearMonth}`,
      codeType: "saleProdCd",
    });
    urls.push({
      url: `${API_BASE}?prodCode=${encodeURIComponent(sale)}&yearMonth=${yearMonth}`,
      codeType: "prodCode_sale",
    });
  }

  return urls;
}

export function mergeSearchCalendar(
  target: Record<string, HanatourCalendarDay[]>,
  source: Record<string, HanatourCalendarDay[]> | undefined,
): Record<string, HanatourCalendarDay[]> {
  if (!source) return target;
  for (const [key, rows] of Object.entries(source)) {
    if (Array.isArray(rows) && rows.length > 0) {
      target[key] = rows;
    }
  }
  return target;
}

export function mergeCalendarDataRows(
  target: HanatourCalendarDataRow[],
  rows: HanatourCalendarDataRow[] | undefined,
): HanatourCalendarDataRow[] {
  if (!rows?.length) return target;
  const seen = new Set(target.map((row) => row.depDay).filter(Boolean));
  for (const row of rows) {
    if (!row.depDay || seen.has(row.depDay)) continue;
    seen.add(row.depDay);
    target.push(row);
  }
  return target;
}

export function mergeHanatourCalendarPayloads(
  a: HanatourCalendarPayload | null | undefined,
  b: HanatourCalendarPayload | null | undefined,
): HanatourCalendarPayload | null {
  if (!a) return b ?? null;
  if (!b) return a;

  const searchCalendar: Record<string, HanatourCalendarDay[]> = {};
  mergeSearchCalendar(searchCalendar, a.searchCalendar);
  mergeSearchCalendar(searchCalendar, b.searchCalendar);

  const calendarData: HanatourCalendarDataRow[] = [];
  mergeCalendarDataRows(calendarData, a.calendarData);
  mergeCalendarDataRows(calendarData, b.calendarData);

  const hasSearch = Object.keys(searchCalendar).length > 0;
  const hasData = calendarData.length > 0;
  if (!hasSearch && !hasData) return null;

  return {
    prodCode: b.prodCode || a.prodCode,
    saleProdCd: b.saleProdCd ?? a.saleProdCd,
    rprsProdCd: b.rprsProdCd ?? a.rprsProdCd,
    depDay: b.depDay ?? a.depDay,
    searchCalendar: hasSearch ? searchCalendar : undefined,
    calendarData: hasData ? calendarData : undefined,
    fetchMeta: [...(a.fetchMeta ?? []), ...(b.fetchMeta ?? [])],
  };
}

export type DepartureScheduleAlertInput = {
  departureScheduleCount?: number | null;
  hanatourCalendarPayload?: HanatourCalendarPayload | null;
};

export function formatDepartureScheduleAlert({
  departureScheduleCount,
  hanatourCalendarPayload,
}: DepartureScheduleAlertInput): string {
  if (departureScheduleCount != null && departureScheduleCount > 0) {
    return `출발일: ${departureScheduleCount}건`;
  }
  if (hanatourCalendarPayload) {
    return "출발일: API 응답은 있으나 파싱 결과 0건";
  }
  return "출발일: API 미응답 (상품은 저장됨)";
}
