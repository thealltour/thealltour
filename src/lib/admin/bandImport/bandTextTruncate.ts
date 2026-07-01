const ITINERARY_MARKERS = /(?:^|\n)\s*(?:제\s*)?\d+\s*일차|일정표|DAY\s*\d+/i;

export const BAND_MAX_META_CHARS = 18_000;
export const BAND_MAX_ITINERARY_CHARS = 48_000;

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

export function buildBandMetaSourceText(hwpText: string, bandText: string): string {
  const parts: string[] = [];
  const hwp = hwpText.trim();
  const band = bandText.trim();
  if (hwp) parts.push(hwp);
  if (band) parts.push(band);
  return truncateBandText(parts.join("\n\n"), BAND_MAX_META_CHARS);
}

export function buildBandItinerarySourceText(hwpText: string, bandText: string): string {
  const hwp = hwpText.trim();
  const band = bandText.trim();
  const source = hwp || band;
  return truncateBandItineraryText(source);
}
