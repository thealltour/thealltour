/** 해시태그 키워드 배열을 meta_title 저장용 문자열로 변환 (스페이스 구분, # 제거) */
export function normalizeSeoHashtagToken(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim();
}

export function formatSeoHashtagsForMetaTitle(
  tags: string[] | null | undefined,
): string | null {
  if (!tags?.length) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const token = normalizeSeoHashtagToken(raw);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out.length > 0 ? out.join(" ") : null;
}
