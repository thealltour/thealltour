/**
 * `YYYY-MM-DD` ISO 날짜 문자열 검증/파싱 + 한국어 요일 라벨 공용 유틸.
 *
 * 기존에 아래 파일들에 개별적으로 구현되어 있던 동일 로직의 정본이다:
 * - `src/lib/inquiry/desiredDeparture.ts`의 `ISO_DATE_RE` + `isIsoDateYmd`
 * - `src/lib/datePickerUtils.ts`의 `ymdToDate` 내부 검증 로직
 * - `src/lib/products/productFixedDeparture.ts`의 `WEEKDAY` 배열
 */

export const ISO_DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function isIsoDateYmd(value: string): boolean {
  if (!ISO_DATE_YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** 유효한 ISO YMD면 로컬 타임존 기준 `Date`를, 아니면 `undefined`를 반환 */
export function parseIsoDateYmd(value: string | null | undefined): Date | undefined {
  if (!value || !isIsoDateYmd(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
