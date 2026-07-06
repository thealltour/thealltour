/**
 * 하나투어 달력 API 금액 문자열 → 원화 정수
 * 예: "151만" → 1510000, "136만" → 1360000
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
