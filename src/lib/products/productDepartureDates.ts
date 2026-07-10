import type { Product } from "@/types/product";
import { isIsoDateYmd, kstTodayYmd } from "@/lib/inquiry/desiredDeparture";

const DATE_PARTS_RE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g;
const WEEKDAY_SUFFIX_RE = /\([월화수목금토일]\)\s*$/;
const STALE_DEPARTURE_DAYS = 60;

export const DEFAULT_DEPARTURE_RANGE_MAX_DAYS = 120;

export type NormalizeDepartureDateOptions = {
  /** 연도 없는 M/D·M.D 파싱 시 사용 (미지정 시 KST 현재 연도) */
  defaultYear?: number;
};

export type CollectProductDepartureDatesOptions = {
  /** 홈 골프 달력: from/to가 출발 가능 기간(2일+)일 때 일별 expand (레거시 호환) */
  expandDepartureWindow?: boolean;
};

function stripWeekdaySuffix(value: string): string {
  return value.replace(WEEKDAY_SUFFIX_RE, "").trim();
}

function buildYmd(year: number, month: number, day: number): string | null {
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDateYmd(ymd) ? ymd : null;
}

/** M/D만 있는 출발일이 60일 이상 과거면 내년 회차로 보정 */
export function bumpYearIfStaleDepartureYmd(ymd: string): string {
  if (!isIsoDateYmd(ymd)) return ymd;
  const cutoff = addDaysYmd(kstTodayYmd(), -STALE_DEPARTURE_DAYS);
  if (ymd >= cutoff) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  return buildYmd(y + 1, m, d) ?? ymd;
}

function extractMonthDayFromDateText(raw: string): { month: number; day: number } | null {
  const withoutWeekday = stripWeekdaySuffix(raw.trim());

  const koMatch = withoutWeekday.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (koMatch) {
    return { month: Number(koMatch[2]), day: Number(koMatch[3]) };
  }

  const fullMatch = withoutWeekday.match(/(?:\d{4}[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (fullMatch) {
    return { month: Number(fullMatch[1]), day: Number(fullMatch[2]) };
  }

  const slashMatch = withoutWeekday.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    return { month: Number(slashMatch[1]), day: Number(slashMatch[2]) };
  }

  const dotMatch = withoutWeekday.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dotMatch) {
    return { month: Number(dotMatch[1]), day: Number(dotMatch[2]) };
  }

  return null;
}

/**
 * 상품 출발일 문자열을 달력·집계용 YYYY-MM-DD로 정규화합니다.
 * ISO, YYYY.MM.DD(요일), 연도 없는 M/D·M.D(요일), 한국식 YYYY년 M월 D일 형식을 지원합니다.
 */
export function normalizeProductDepartureDateToYmd(
  raw: string | null | undefined,
  options?: NormalizeDepartureDateOptions,
): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (isIsoDateYmd(trimmed)) return trimmed;

  const withoutWeekday = stripWeekdaySuffix(trimmed);

  const koFullMatch = withoutWeekday.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (koFullMatch) {
    const ymd = buildYmd(Number(koFullMatch[1]), Number(koFullMatch[2]), Number(koFullMatch[3]));
    if (ymd) return ymd;
  }

  const koMdMatch = withoutWeekday.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (koMdMatch) {
    const year = options?.defaultYear ?? Number(kstTodayYmd().slice(0, 4));
    const ymd = buildYmd(year, Number(koMdMatch[1]), Number(koMdMatch[2]));
    if (ymd) return bumpYearIfStaleDepartureYmd(ymd);
  }

  const fullMatch = withoutWeekday.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (fullMatch) {
    const ymd = buildYmd(Number(fullMatch[1]), Number(fullMatch[2]), Number(fullMatch[3]));
    if (ymd) return ymd;
  }

  if (!/\d{4}/.test(withoutWeekday)) {
    const slashMatch = withoutWeekday.match(/^(\d{1,2})\/(\d{1,2})$/);
    const dotMatch = withoutWeekday.match(/^(\d{1,2})\.(\d{1,2})$/);
    const md = slashMatch ?? dotMatch;
    if (md) {
      const year = options?.defaultYear ?? Number(kstTodayYmd().slice(0, 4));
      const ymd = buildYmd(year, Number(md[1]), Number(md[2]));
      if (ymd) return bumpYearIfStaleDepartureYmd(ymd);
    }
  }

  return null;
}

/** AI가 붙인 연도를 무시하고 defaultYear로 월·일만 재조합 (밴드 import 원문 무연도용) */
export function normalizeProductDepartureDateToYmdWithForcedYear(
  raw: string | null | undefined,
  defaultYear: number,
): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  const md = extractMonthDayFromDateText(trimmed);
  if (md) {
    const ymd = buildYmd(defaultYear, md.month, md.day);
    if (ymd) return bumpYearIfStaleDepartureYmd(ymd);
  }

  return normalizeProductDepartureDateToYmd(trimmed, { defaultYear });
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 두 YMD 사이 일수 차이(절대값). 항공 출발·도착(0~1일) vs 출발 가능 기간 구분용 */
export function ymdDayDiff(a: string, b: string): number {
  if (!isIsoDateYmd(a) || !isIsoDateYmd(b)) return Number.POSITIVE_INFINITY;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad, 12, 0, 0, 0);
  const bMs = Date.UTC(by, bm - 1, bd, 12, 0, 0, 0);
  return Math.abs(Math.round((bMs - aMs) / 86_400_000));
}

/** inclusive YMD 범위를 일자 배열로 펼칩니다. maxDays 초과 시 시작일 기준으로 잘립니다. */
export function expandYmdRange(
  start: string,
  end: string,
  maxDays: number = DEFAULT_DEPARTURE_RANGE_MAX_DAYS,
): string[] {
  if (!isIsoDateYmd(start) || !isIsoDateYmd(end)) return [];

  let from = start;
  let to = end;
  if (from > to) [from, to] = [to, from];

  const result: string[] = [];
  let current = from;
  while (result.length < maxDays) {
    result.push(current);
    if (current === to) break;
    current = addDaysYmd(current, 1);
  }
  return result;
}

/** 단일일 또는 범위 문자열(2026.07.01~2026.08.31 등)을 파싱합니다. */
export function parseDepartureRangeText(
  raw: string | null | undefined,
): { start: string; end: string } | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  const matches = [...trimmed.matchAll(DATE_PARTS_RE)];
  if (matches.length >= 2) {
    const start = normalizeProductDepartureDateToYmd(matches[0][0]);
    const end = normalizeProductDepartureDateToYmd(matches[matches.length - 1][0]);
    if (start && end) return { start, end };
    return null;
  }

  const single = normalizeProductDepartureDateToYmd(trimmed);
  return single ? { start: single, end: single } : null;
}

function addDatesFromText(dates: Set<string>, raw: string | null | undefined): void {
  const parsed = parseDepartureRangeText(raw);
  if (!parsed) return;

  if (parsed.start === parsed.end) {
    dates.add(parsed.start);
    return;
  }

  for (const ymd of expandYmdRange(parsed.start, parsed.end)) {
    dates.add(ymd);
  }
}

function addDatesFromFromToFields(
  dates: Set<string>,
  product: Product,
  expandDepartureWindow: boolean,
): void {
  const fromRaw = product.departure_from_date?.trim();
  const toRaw = product.departure_to_date?.trim();
  const fromHasRange = Boolean(fromRaw && /[~～–—]/.test(fromRaw));

  if (fromHasRange) {
    addDatesFromText(dates, fromRaw);
  } else if (fromRaw && toRaw) {
    const fromYmd = normalizeProductDepartureDateToYmd(fromRaw);
    const toYmd = normalizeProductDepartureDateToYmd(toRaw);
    if (fromYmd && toYmd) {
      if (fromYmd === toYmd) {
        dates.add(fromYmd);
      } else if (ymdDayDiff(fromYmd, toYmd) <= 1) {
        // 항공 출발일·현지 도착일(0~1일 차) — 출발일만 달력에 표시
        dates.add(fromYmd);
      } else if (expandDepartureWindow) {
        // 출발 가능 기간 — 일별 expand (홈 골프 달력 레거시 호환)
        for (const ymd of expandYmdRange(fromYmd, toYmd)) {
          dates.add(ymd);
        }
      } else {
        // 여정 전체 기간(귀국일 등) — 출발일만 달력에 표시
        dates.add(fromYmd);
      }
    } else if (fromYmd) {
      dates.add(fromYmd);
    }
  } else if (fromRaw) {
    addDatesFromText(dates, fromRaw);
  } else if (toRaw) {
    addDatesFromText(dates, toRaw);
  }
}

/** 상품 1건의 모든 출발 가능 YMD를 수집합니다. */
export function collectProductDepartureDates(
  product: Product,
  options?: CollectProductDepartureDatesOptions,
): string[] {
  const expandDepartureWindow = options?.expandDepartureWindow ?? false;
  const dates = new Set<string>();

  for (const schedule of product.departureSchedules ?? []) {
    addDatesFromText(dates, schedule.departureDate);
  }

  for (const raw of product.departures ?? []) {
    addDatesFromText(dates, raw);
  }

  // 파싱 가능한 스케줄·departures가 있으면 from/to fallback 생략
  if (dates.size > 0) {
    return Array.from(dates).sort();
  }

  addDatesFromFromToFields(dates, product, expandDepartureWindow);

  return Array.from(dates).sort();
}
