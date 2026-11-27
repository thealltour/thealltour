import { isIsoDateYmd, kstTodayYmd } from "@/lib/inquiry/desiredDeparture";
import { ymdToDate } from "@/lib/datePickerUtils";

/**
 * KST 오늘(포함) 이후 출발일만 남긴다.
 * 상세 달력·견적 자동입력과 목록 골프 달력의 “오늘 기준”을 맞춘다.
 */
export function filterBookableDepartureYmds(
  ymds: string[],
  todayYmd: string = kstTodayYmd(),
): string[] {
  return [...new Set(ymds)]
    .filter((ymd) => isIsoDateYmd(ymd) && ymd >= todayYmd)
    .sort();
}

/** 첫 예약 가능 출발일이 있는 달(1일). 없으면 null */
export function resolveFirstBookableDepartureMonth(
  ymds: string[],
  todayYmd: string = kstTodayYmd(),
): Date | null {
  const first = filterBookableDepartureYmds(ymds, todayYmd)[0];
  if (!first) return null;
  const date = ymdToDate(first);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isBookableDepartureYmd(
  ymd: string | null | undefined,
  todayYmd: string = kstTodayYmd(),
): boolean {
  const trimmed = ymd?.trim() ?? "";
  return isIsoDateYmd(trimmed) && trimmed >= todayYmd;
}
