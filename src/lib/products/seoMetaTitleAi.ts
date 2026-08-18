import { formatSeoHashtagsForMetaTitle } from "@/lib/products/formatSeoHashtagsForMetaTitle";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";

export const SEO_META_TITLE_MIN_TAGS = 4;
export const SEO_META_TITLE_MAX_TAGS = 8;

/** 밴드·통합익스텐션 메타 파싱 공통. 추출이 아니라 검색 키워드 작성. */
export const SEO_META_TITLE_AI_PROMPT_RULES = `seo_hashtags / meta_title: 4–8 Korean search keywords, no #.
Prefer tokens from a dedicated "AI 해시태그" or SEO hashtag section when present.
Otherwise COMPOSE from destination, theme, and selling highlights.
Do NOT copy the full product title. Do NOT reuse inline #keywords from the title.
Do not invent unrelated destinations.`;

function tokensFromUnknown(raw: string | string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return parseMetaTitleAsHashtags(raw.join(" "));
  }
  return parseMetaTitleAsHashtags(raw.replace(/[,/|]+/g, " "));
}

/** AI·원문 키워드를 meta_title 저장 형식(공백 구분, # 제거, 최대 8개)으로 정규화 */
export function normalizeSeoMetaTitleKeywords(
  raw: string | string[] | null | undefined,
): string | null {
  const tokens = tokensFromUnknown(raw).slice(0, SEO_META_TITLE_MAX_TAGS);
  return formatSeoHashtagsForMetaTitle(tokens);
}
