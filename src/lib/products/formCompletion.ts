/**
 * 폼 완료/필수·권장 판정용 유틸.
 * placeholder나 표시용 문자열은 "입력된 값"으로 간주하지 않는다.
 */

/** placeholder처럼 보이는 문자열인지 방어적 판별 (실제 사용자 입력은 통과) */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^예[:\)]\s*/i,
  /^예\.\s*/i,
  /입력(해)?\s*주세요/i,
  /선택(해)?\s*주세요/i,
  /^선택$/,
];

function looksLikePlaceholder(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

/**
 * 실제 입력된 텍스트가 있는지 판정.
 * - string이 아니면 false
 * - trim 후 길이 0이면 false
 * - placeholder 패턴에 해당하면 false (방어용)
 */
export function hasRealText(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (t.length === 0) return false;
  if (looksLikePlaceholder(t)) return false;
  return true;
}

/**
 * 유효한 숫자(가격 등)인지 판정.
 * - number: isFinite && value > 0
 * - string: 정수 파싱 후 동일 기준 (쉼표/공백 제거 후)
 */
export function hasValidNumber(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/~/g, "").replace(/\s/g, "").trim();
    if (!normalized) return false;
    const n = parseInt(normalized, 10);
    return !Number.isNaN(n) && n > 0;
  }
  return false;
}

/** 길이 0이 아닌 배열인지 */
export function hasNonEmptyArray(arr: unknown): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * JSON 텍스트가 비어있지 않고 파싱 가능한지.
 * placeholder만 있는 문자열은 hasRealText에서 걸러진 뒤 여기서 false.
 */
export function hasValidJsonText(jsonText: unknown): boolean {
  if (!hasRealText(jsonText)) return false;
  const raw = String(jsonText).trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object";
  } catch {
    return false;
  }
}

/**
 * 가격 옵션 JSON으로 유효한 groups 배열이 있는지.
 * (form.options_json 전용)
 */
/**
 * 계절·주말·성수기 구간가 중 하나라도 유효한 양의 숫자인지
 */
export function hasAnyValidSeasonalPriceBand(form: {
  seasonal_price_bands: { offSeason: string; weekend: string; peakSeason: string };
}): boolean {
  const b = form.seasonal_price_bands;
  return hasValidNumber(b.offSeason) || hasValidNumber(b.weekend) || hasValidNumber(b.peakSeason);
}

export function hasValidPriceOptionJson(jsonText: unknown): boolean {
  if (!hasValidJsonText(jsonText)) return false;
  try {
    const parsed = JSON.parse(String(jsonText).trim()) as { groups?: unknown[] };
    return Boolean(parsed?.groups && Array.isArray(parsed.groups) && parsed.groups.length > 0);
  } catch {
    return false;
  }
}

/** 이미지 URL 배열(또는 단일 URL)이 실제로 1개 이상 있는지. 빈 문자열/빈 배열/placeholder 아님. */
export function hasAnyImage(
  imageUrlOrArray: string | Array<string | null | undefined> | null | undefined,
): boolean {
  if (imageUrlOrArray == null) return false;
  if (typeof imageUrlOrArray === "string") return hasRealText(imageUrlOrArray);
  if (!Array.isArray(imageUrlOrArray)) return false;
  return imageUrlOrArray.some((item) => typeof item === "string" && hasRealText(item));
}

/**
 * 대표(cover) 이미지가 있는지.
 * - 단일 image_url이 있거나
 * - images 배열에 유효 URL이 1개 이상 있으면 true (첫 항목을 cover로 사용하는 구조)
 */
export function hasCoverImage(
  imageUrl: string | null | undefined,
  imagesArray: Array<string | null | undefined> | null | undefined,
): boolean {
  if (hasRealText(imageUrl)) return true;
  if (!Array.isArray(imagesArray)) return false;
  return imagesArray.some((item) => typeof item === "string" && hasRealText(item));
}
