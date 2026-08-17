/**
 * SEO meta description/JSON-LD 텍스트 truncate 공용 유틸.
 * 공백 정규화(연속 공백 → 1개) 후 `maxLen` 기준으로 자르고 말줄임표(…)를 붙인다.
 *
 * 기존에 `src/lib/seo/products.ts`(기본 200자), `src/lib/seo/reviews.ts`(기본 155자)에
 * 동일하게 중복 정의되어 있던 로직의 정본.
 */
export function truncateForMeta(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 1).trim() + "…";
}
