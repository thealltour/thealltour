import { ymdToDate } from "@/lib/datePickerUtils";

export type KrPublicHoliday = {
  date: string;
  name: string;
};

/** 대한민국 공휴일 (2025~2028, 대체공휴일 포함) */
export const KR_PUBLIC_HOLIDAYS: KrPublicHoliday[] = [
  // 2025
  { date: "2025-01-01", name: "신정" },
  { date: "2025-01-28", name: "설날 연휴" },
  { date: "2025-01-29", name: "설날" },
  { date: "2025-01-30", name: "설날 연휴" },
  { date: "2025-03-01", name: "삼일절" },
  { date: "2025-03-03", name: "삼일절 대체공휴일" },
  { date: "2025-05-05", name: "어린이날" },
  { date: "2025-05-06", name: "부처님오신날 대체공휴일" },
  { date: "2025-06-06", name: "현충일" },
  { date: "2025-08-15", name: "광복절" },
  { date: "2025-10-03", name: "개천절" },
  { date: "2025-10-05", name: "추석 연휴" },
  { date: "2025-10-06", name: "추석" },
  { date: "2025-10-07", name: "추석 연휴" },
  { date: "2025-10-08", name: "추석 대체공휴일" },
  { date: "2025-10-09", name: "한글날" },
  { date: "2025-12-25", name: "성탄절" },
  // 2026
  { date: "2026-01-01", name: "신정" },
  { date: "2026-02-16", name: "설날 연휴" },
  { date: "2026-02-17", name: "설날" },
  { date: "2026-02-18", name: "설날 연휴" },
  { date: "2026-03-01", name: "삼일절" },
  { date: "2026-03-02", name: "삼일절 대체공휴일" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-24", name: "부처님오신날" },
  { date: "2026-05-25", name: "부처님오신날 대체공휴일" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-08-17", name: "광복절 대체공휴일" },
  { date: "2026-09-24", name: "추석 연휴" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-09-26", name: "추석 연휴" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-25", name: "성탄절" },
  // 2027
  { date: "2027-01-01", name: "신정" },
  { date: "2027-02-06", name: "설날 연휴" },
  { date: "2027-02-07", name: "설날" },
  { date: "2027-02-08", name: "설날 연휴" },
  { date: "2027-03-01", name: "삼일절" },
  { date: "2027-05-05", name: "어린이날" },
  { date: "2027-05-13", name: "부처님오신날" },
  { date: "2027-06-06", name: "현충일" },
  { date: "2027-06-07", name: "현충일 대체공휴일" },
  { date: "2027-08-15", name: "광복절" },
  { date: "2027-08-16", name: "광복절 대체공휴일" },
  { date: "2027-09-14", name: "추석 연휴" },
  { date: "2027-09-15", name: "추석" },
  { date: "2027-09-16", name: "추석 연휴" },
  { date: "2027-10-03", name: "개천절" },
  { date: "2027-10-04", name: "개천절 대체공휴일" },
  { date: "2027-10-09", name: "한글날" },
  { date: "2027-10-11", name: "한글날 대체공휴일" },
  { date: "2027-12-25", name: "성탄절" },
  { date: "2027-12-27", name: "성탄절 대체공휴일" },
  // 2028
  { date: "2028-01-01", name: "신정" },
  { date: "2028-01-03", name: "신정 대체공휴일" },
  { date: "2028-01-25", name: "설날 연휴" },
  { date: "2028-01-26", name: "설날" },
  { date: "2028-01-27", name: "설날 연휴" },
  { date: "2028-03-01", name: "삼일절" },
  { date: "2028-05-02", name: "부처님오신날" },
  { date: "2028-05-05", name: "어린이날" },
  { date: "2028-06-06", name: "현충일" },
  { date: "2028-08-15", name: "광복절" },
  { date: "2028-10-02", name: "추석 연휴" },
  { date: "2028-10-03", name: "추석" },
  { date: "2028-10-04", name: "추석 연휴" },
  { date: "2028-10-09", name: "한글날" },
  { date: "2028-12-25", name: "성탄절" },
];

const holidayNameByDate = new Map(KR_PUBLIC_HOLIDAYS.map((h) => [h.date, h.name]));

export function getKrPublicHolidayName(ymd: string): string | null {
  return holidayNameByDate.get(ymd) ?? null;
}

export function getKrPublicHolidayDatesForYears(years: number[]): Date[] {
  const yearSet = new Set(years);
  const dates: Date[] = [];
  for (const holiday of KR_PUBLIC_HOLIDAYS) {
    const year = Number(holiday.date.slice(0, 4));
    if (!yearSet.has(year)) continue;
    const date = ymdToDate(holiday.date);
    if (date) dates.push(date);
  }
  return dates;
}

export function collectYearsFromYmdList(ymdList: string[]): number[] {
  const years = new Set<number>();
  for (const ymd of ymdList) {
    const year = Number(ymd.slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  }
  return Array.from(years).sort((a, b) => a - b);
}
