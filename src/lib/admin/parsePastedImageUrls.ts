/**
 * 붙여넣기 영역(북마클릿 결과)에서 이미지 URL 목록 파싱
 * - 줄바꿈, 쉼표, 공백 기준 분리
 * - http/https만 허용, 중복 제거
 */

export function parsePastedImageUrls(text: string): string[] {
  const raw = text
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of raw) {
    const normalized = s.replace(/^["'\s()]+|["'\s()]+$/g, "");
    if (!/^https?:\/\//i.test(normalized)) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}
