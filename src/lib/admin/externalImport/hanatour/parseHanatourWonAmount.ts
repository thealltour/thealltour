/**
 * 하나투어 달력 API 금액 문자열 → 원화 정수
 * 예: "151만" → 1510000, "136만" → 1360000
 *
 * DOM 캘린더는 "641만"처럼 만 원 단위로 절사되는 경우가 있어,
 * 본문 대표가(basePrice)의 끝 4자리를 더해 실제 결제 금액으로 복원한다.
 */

/** "최저가 136만" → "136만", "1,519,900" 등 숫자 부분만 추출 */
export function normalizeHanatourPriceText(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed === "-") return null;

  const manMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*만(?:원)?/);
  if (manMatch) return `${manMatch[1]}만`;

  const commaMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+)/);
  if (commaMatch) return commaMatch[1];

  const digitsMatch = trimmed.match(/\b(\d{5,})\b/);
  if (digitsMatch) return digitsMatch[1];

  return null;
}

export function parseHanatourWonAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }

  if (typeof raw !== "string") return null;

  const normalized = normalizeHanatourPriceText(raw);
  const trimmed = (normalized ?? raw).trim().replace(/,/g, "");
  if (!trimmed) return null;

  const manMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?$/);
  if (manMatch) {
    const value = Number(manMatch[1]) * 10_000;
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  const digitsOnly = trimmed.match(/^(\d+)$/);
  if (digitsOnly) {
    const value = Number(digitsOnly[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  return null;
}

/**
 * 캘린더의 "641만" 문자열을 실제 원화 정수로 복원 (대표 가격의 끝 4자리 반영).
 * 이미 원 단위 정수(숫자/숫자 문자열)이면 basePrice를 적용하지 않는다.
 */
export function parseHanatourCalendarPrice(
  adtAmt: string | number | null | undefined,
  basePrice?: number | null,
): number | null {
  if (adtAmt == null || adtAmt === "") return null;

  if (typeof adtAmt === "number") {
    return parseHanatourWonAmount(adtAmt);
  }

  if (typeof adtAmt !== "string") return null;

  const normalized = normalizeHanatourPriceText(adtAmt);
  const trimmed = (normalized ?? adtAmt).trim().replace(/,/g, "");
  if (!trimmed) return null;

  const manMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*만(?:원)?$/);
  if (manMatch) {
    const manUnit = Number(manMatch[1]);
    if (!Number.isFinite(manUnit) || manUnit <= 0) return null;
    const baseManWon = Math.round(manUnit * 10_000);
    const trailing =
      basePrice != null && Number.isFinite(basePrice) && basePrice > 0
        ? Math.round(basePrice) % 10_000
        : 0;
    return baseManWon + trailing;
  }

  return parseHanatourWonAmount(adtAmt);
}
