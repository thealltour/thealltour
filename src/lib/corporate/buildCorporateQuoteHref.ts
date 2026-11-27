export type CorporateQuoteCategory =
  | "corporate"
  | "corporate-business"
  | "corporate-public-enterprises"
  | "corporate-public-institutions"
  | "corporate-councils";

export const CORPORATE_QUOTE_CATEGORIES: readonly CorporateQuoteCategory[] = [
  "corporate",
  "corporate-business",
  "corporate-public-enterprises",
  "corporate-public-institutions",
  "corporate-councils",
] as const;

export function isCorporateQuoteCategory(
  value: string | null | undefined,
): value is CorporateQuoteCategory {
  return (
    typeof value === "string" &&
    (CORPORATE_QUOTE_CATEGORIES as readonly string[]).includes(value.trim())
  );
}

/**
 * 기업·기관 공개 화면 → 기존 /quote 진입 URL.
 * program 은 선택 — 상세 프로그램 CTA에서만 전달.
 */
export function buildCorporateQuoteHref(input: {
  sourcePath: string;
  quoteCategory: CorporateQuoteCategory;
  program?: string | null;
}): string {
  const params = new URLSearchParams();
  const sourcePath = input.sourcePath.trim() || "/corporate";
  params.set("source_path", sourcePath);
  params.set("quote_category", input.quoteCategory);
  const program = input.program?.trim();
  if (program) params.set("program", program);
  return `/quote?${params.toString()}`;
}
