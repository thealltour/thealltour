const ITINERARY_MARKERS = /(?:^|\n)\s*(?:제\s*)?\d+\s*일차|일정표|DAY\s*\d+/i;

export const BAND_MAX_META_CHARS = 18_000;
export const BAND_MAX_ITINERARY_CHARS = 48_000;
/** HWP가 길어도 밴드 홍보 문단이 잘리지 않도록 메타 입력에서 밴드 본문 몫을 확보 */
export const BAND_META_BAND_RESERVE_CHARS = 6_000;
/** 일정 입력에서 HWP 뒤에 붙이는 밴드 본문 상한 */
export const BAND_ITINERARY_BAND_RESERVE_CHARS = 8_000;

export const BAND_SOURCE_BAND_HEADER = "=== 밴드 본문 ===";
export const BAND_SOURCE_HWP_HEADER = "=== HWP 문서 ===";

export function truncateBandText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

/**
 * 긴 HWP에서 일정표 구간을 우선 보존해 잘라냅니다.
 */
export function truncateBandItineraryText(text: string, maxChars: number = BAND_MAX_ITINERARY_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const match = trimmed.match(ITINERARY_MARKERS);
  if (!match?.index || match.index <= 0) {
    return trimmed.slice(0, maxChars);
  }

  const start = Math.max(0, match.index - 500);
  const slice = trimmed.slice(start, start + maxChars);
  return slice.length < maxChars && start > 0
    ? trimmed.slice(Math.max(0, trimmed.length - maxChars))
    : slice;
}

function joinSections(sections: Array<[string, string]>): string {
  return sections
    .filter(([, body]) => body.length > 0)
    .map(([header, body]) => `${header}\n${body}`)
    .join("\n\n");
}

/** 두 섹션 헤더와 구분 줄바꿈이 차지하는 길이 */
const SECTION_OVERHEAD = BAND_SOURCE_BAND_HEADER.length + BAND_SOURCE_HWP_HEADER.length + 4;

export function buildBandMetaSourceText(hwpText: string, bandText: string): string {
  const hwp = hwpText.trim();
  const band = bandText.trim();
  if (!hwp) return truncateBandText(band, BAND_MAX_META_CHARS);
  if (!band) return truncateBandText(hwp, BAND_MAX_META_CHARS);

  const available = BAND_MAX_META_CHARS - SECTION_OVERHEAD;
  const bandBudget = Math.min(band.length, Math.max(BAND_META_BAND_RESERVE_CHARS, available - hwp.length));
  const hwpBudget = Math.max(0, available - bandBudget);

  return joinSections([
    [BAND_SOURCE_BAND_HEADER, band.slice(0, bandBudget)],
    [BAND_SOURCE_HWP_HEADER, truncateBandText(hwp, hwpBudget)],
  ]);
}

export function buildBandItinerarySourceText(hwpText: string, bandText: string): string {
  const hwp = hwpText.trim();
  const band = bandText.trim();
  if (!hwp) return truncateBandItineraryText(band);
  if (!band) return truncateBandItineraryText(hwp);

  const available = BAND_MAX_ITINERARY_CHARS - SECTION_OVERHEAD;
  const bandReserve = Math.min(band.length, BAND_ITINERARY_BAND_RESERVE_CHARS);
  const hwpPart = truncateBandItineraryText(hwp, available - bandReserve);
  const bandPart = band.slice(0, Math.max(0, available - hwpPart.length));

  return joinSections([
    [BAND_SOURCE_HWP_HEADER, hwpPart],
    [BAND_SOURCE_BAND_HEADER, bandPart],
  ]);
}
