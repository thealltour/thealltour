import { normalizeSeoHashtagToken } from "@/lib/products/formatSeoHashtagsForMetaTitle";

/** SEO 메타 타이틀을 해시태그용 단어 배열로 반환
 * - `#키워드` 토큰 우선 추출
 * - 남은 텍스트는 공백 기준 분리
 * 예: "태국 파크골프" -> ["태국", "파크골프"]
 * 예: "#아름다운풍경속여행 #특별한추억만들기" -> ["아름다운풍경속여행", "특별한추억만들기"]
 */
export function parseMetaTitleAsHashtags(metaTitle?: string): string[] {
  if (!metaTitle?.trim()) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const token = normalizeSeoHashtagToken(raw);
    if (!token || seen.has(token)) return;
    seen.add(token);
    out.push(token);
  };

  const hashMatches = metaTitle.match(/#[^\s#]+/g);
  if (hashMatches?.length) {
    for (const match of hashMatches) {
      push(match);
    }
    const remainder = metaTitle.replace(/#[^\s#]+/g, " ").trim();
    if (remainder) {
      for (const part of remainder.split(/\s+/)) {
        push(part);
      }
    }
    return out;
  }

  return metaTitle
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Search List card tag cap — parser order preserved, no ranking engine */
export const PRODUCT_CARD_LIST_TAG_MAX = {
  mobile: 2,
  desktop: 3,
} as const;

export function limitProductCardListTags(tags: readonly string[], max: number): string[] {
  const cap = Math.max(0, Math.floor(max));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}
