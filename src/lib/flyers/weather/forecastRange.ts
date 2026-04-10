/**
 * WeatherAPI forecast는 통상 "오늘"부터 N일치를 반환한다.
 * 여행 종료일까지 필요한 API days(1~14)와, 응답에서 쓸 날짜 범위(YYYY-MM-DD)를 계산한다.
 */

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function todayYmdUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const da = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function cmpYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export type ForecastRangeResult =
  | { ok: true; apiDays: number; filterFrom: string; filterTo: string }
  | { ok: false; message: string };

/**
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 */
export function computeForecastRequestRange(startDate: string, endDate: string): ForecastRangeResult {
  const s = startDate.trim();
  const e = endDate.trim();
  if (!isYmd(s) || !isYmd(e)) {
    return { ok: false, message: "출발일·도착일은 YYYY-MM-DD 형식이어야 합니다." };
  }
  if (cmpYmd(s, e) > 0) {
    return { ok: false, message: "도착일은 출발일 이후여야 합니다." };
  }

  const today = todayYmdUtc();
  if (cmpYmd(e, today) < 0) {
    return { ok: false, message: "도착일이 이미 지났습니다. 예보를 사용할 수 없습니다." };
  }

  const tripStart = cmpYmd(s, today) < 0 ? today : s;
  const tripEnd = e;

  const startMs = ymdToUtcNoon(today).getTime();
  const endMs = ymdToUtcNoon(tripEnd).getTime();
  const diffDays = Math.ceil((endMs - startMs) / 86_400_000) + 1;
  const apiDays = Math.min(14, Math.max(1, diffDays));

  return { ok: true, apiDays, filterFrom: tripStart, filterTo: tripEnd };
}
