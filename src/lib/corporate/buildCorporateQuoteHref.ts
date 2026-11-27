export type CorporateQuoteCategory =
  | "corporate"
  | "corporate-business"
  | "corporate-public-enterprises"
  | "corporate-public-institutions"
  | "corporate-councils";

/**
 * 기업·기관 공개 화면 → 기존 /quote 진입 URL.
 * PR 1 범위: source_path·quote_category 전달까지.
 */
export function buildCorporateQuoteHref(input: {
  sourcePath: string;
  quoteCategory: CorporateQuoteCategory;
}): string {
  const params = new URLSearchParams();
  const sourcePath = input.sourcePath.trim() || "/corporate";
  params.set("source_path", sourcePath);
  params.set("quote_category", input.quoteCategory);
  return `/quote?${params.toString()}`;
}
