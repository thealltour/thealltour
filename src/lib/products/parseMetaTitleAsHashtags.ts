/** SEO 메타 타이틀을 스페이스로 구분해 해시태그용 단어 배열로 반환
 * - 공백 기준으로 분리
 * - 양 끝 공백 제거
 * - 빈 문자열은 제거
 * 예: "태국 파크골프 치앙마이" -> ["태국", "파크골프", "치앙마이"]
 */
export function parseMetaTitleAsHashtags(metaTitle?: string): string[] {
  if (!metaTitle?.trim()) return [];
  return metaTitle
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

