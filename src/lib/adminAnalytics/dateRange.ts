/**
 * 관리자 대시보드·taxonomy analytics 공통 날짜 범위 파서.
 * 후속 PR에서 /api/admin/dashboard, taxonomy 성과 API에서 재사용.
 * 계약: range / from / to 는 AdminDashboardKpiSection 및 /api/admin/dashboard 와 동일.
 */

export type AdminDateRangeResult = {
  startIso: string;
  endIso: string;
  label: string;
  isCustom: boolean;
};

const RANGE_TODAY = "today";
const RANGE_7D = "7d";
const RANGE_30D = "30d";
const RANGE_CUSTOM = "custom";

/**
 * ISO 날짜 문자열(YYYY-MM-DD) 또는 ISO datetime 파싱.
 */
function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 해당 날짜의 00:00:00.000 (로컬) ISO */
function startOfDayLocal(d: Date): string {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

/** 해당 날짜의 다음날 00:00:00.000 (로컬) ISO — end는 exclusive */
function endOfDayExclusiveLocal(d: Date): string {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

/**
 * 관리자용 날짜 범위 파싱.
 * - today: 오늘 00:00 ~ 내일 00:00 (exclusive end)
 * - 7d: 오늘 포함 최근 7일 (start = today-6일 00:00, end = 내일 00:00)
 * - 30d: 오늘 포함 최근 30일
 * - custom: from/to 가 유효할 때만 사용; invalid 시 fallback
 * - invalid range 또는 custom에서 from/to 부재·유효하지 않으면 7d 사용 (기존 대시보드 기본값과 동일).
 */
export function parseAdminDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): AdminDateRangeResult {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const range = (params.range ?? "").toLowerCase().trim();

  if (range === RANGE_CUSTOM) {
    const fromDate = params.from ? parseIsoDate(params.from) : null;
    const toDate = params.to ? parseIsoDate(params.to) : null;
    if (fromDate && toDate && fromDate.getTime() <= toDate.getTime()) {
      return {
        startIso: startOfDayLocal(fromDate),
        endIso: endOfDayExclusiveLocal(toDate),
        label: "custom",
        isCustom: true,
      };
    }
  } else if (range === RANGE_TODAY) {
    return {
      startIso: startOfDayLocal(todayStart),
      endIso: endOfDayExclusiveLocal(todayStart),
      label: RANGE_TODAY,
      isCustom: false,
    };
  } else if (range === RANGE_7D) {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return {
      startIso: startOfDayLocal(start),
      endIso: endOfDayExclusiveLocal(todayStart),
      label: RANGE_7D,
      isCustom: false,
    };
  } else if (range === RANGE_30D) {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 29);
    return {
      startIso: startOfDayLocal(start),
      endIso: endOfDayExclusiveLocal(todayStart),
      label: RANGE_30D,
      isCustom: false,
    };
  }

  // invalid or empty range → 7d (기존 대시보드 기본값)
  const start = new Date(todayStart);
  start.setDate(start.getDate() - 6);
  return {
    startIso: startOfDayLocal(start),
    endIso: endOfDayExclusiveLocal(todayStart),
    label: RANGE_7D,
    isCustom: false,
  };
}
