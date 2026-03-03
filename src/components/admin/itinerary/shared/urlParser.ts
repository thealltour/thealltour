/**
 * URL 목록 파싱/정규화/중복 제거 유틸
 * - EventImagesEditor 등에서 여러 줄/쉼표/공백으로 구분된 URL 문자열 처리용
 */

/**
 * URL 문자열 trim 후 반환 (빈 문자열 가능)
 */
export function normalizeUrl(url: string): string {
  return url.trim();
}

/**
 * http:// 또는 https:// 로 시작하는지 여부
 */
export function isAllowedUrl(url: string): boolean {
  return /^https?:\/\//i.test(normalizeUrl(url));
}

/**
 * 입력 문자열을 줄바꿈·쉼표·공백으로 분리한 뒤 trim하여 비지 않은 URL 후보 배열 반환
 * (프로토콜 검증은 하지 않음 — 호출측에서 isAllowedUrl로 필터)
 */
export function parseUrls(input: string): string[] {
  if (!input || typeof input !== "string") return [];
  const raw = input
    .split(/[\n,\s]+/)
    .map((s) => normalizeUrl(s))
    .filter((s) => s.length > 0);
  return raw;
}

/**
 * 배열 내 URL 중복 제거 (순서 유지)
 */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of urls) {
    const n = normalizeUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    result.push(n);
  }
  return result;
}
