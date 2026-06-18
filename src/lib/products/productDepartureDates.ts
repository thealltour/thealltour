import type { Product } from "@/types/product";
import { isIsoDateYmd } from "@/lib/inquiry/desiredDeparture";

const DATE_PARTS_RE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g;

export const DEFAULT_DEPARTURE_RANGE_MAX_DAYS = 120;

/**
 * 상품 출발일 문자열을 달력·집계용 YYYY-MM-DD로 정규화합니다.
 * 관리자 항공 섹션 자유 텍스트(예: 2026.02.20(금)) 및 ISO 형식을 지원합니다.
 */
export function normalizeProductDepartureDateToYmd(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (isIsoDateYmd(trimmed)) return trimmed;

  const match = trimmed.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return null;

  const ymd = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isIsoDateYmd(ymd) ? ymd : null;
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

/** 상품 1건의 모든 출발 가능 YMD를 수집합니다. */
export function collectProductDepartureDates(product: Product): string[] {
  const dates = new Set<string>();

  for (const raw of product.departures ?? []) {
    addDatesFromText(dates, raw);
  }

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
      } else {
        for (const ymd of expandYmdRange(fromYmd, toYmd)) dates.add(ymd);
      }
    } else if (fromYmd) {
      dates.add(fromYmd);
    }
  } else if (fromRaw) {
    addDatesFromText(dates, fromRaw);
  } else if (toRaw) {
    addDatesFromText(dates, toRaw);
  }

  return Array.from(dates).sort();
}
