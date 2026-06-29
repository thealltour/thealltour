import type { Product } from "@/types/product";

/**
 * 상품 상세 SSR(`src/app/products/[id]/page.tsx`)과 동일한 포함/불포함/선택관광 해석.
 * 스마트스토어 HTML 등에서 재사용한다.
 */
export function resolveProductDetailBodyFields(product: Product): {
  resolvedIncludedItems: string;
  resolvedExcludedItems: string;
  resolvedOptionalTours: string | undefined;
  resolvedOptionalExpenses: string | undefined;
} {
  const normalizedIncluded = product.included_items?.trim() ?? "";
  const normalizedExcluded = product.excluded_items?.trim() ?? "";
  const normalizedOptional = product.optional_tours?.trim() ?? "";
  const normalizedOptionalExpenses = product.optional_expenses?.trim() ?? "";
  const normalizedTerms = product.terms_and_notes?.trim() ?? "";
  const shouldFallbackFromLegacyDetailFields =
    !normalizedIncluded && !normalizedExcluded && (normalizedOptional || normalizedTerms);
  const resolvedIncludedItems = shouldFallbackFromLegacyDetailFields
    ? (product.optional_tours ?? product.inclusions ?? "") || ""
    : (product.included_items ?? product.inclusions ?? "") || "";
  const resolvedExcludedItems = shouldFallbackFromLegacyDetailFields
    ? product.terms_and_notes ?? ""
    : product.excluded_items ?? "";
  const resolvedOptionalTours = shouldFallbackFromLegacyDetailFields ? undefined : product.optional_tours;
  const resolvedOptionalExpenses = normalizedOptionalExpenses || undefined;
  return {
    resolvedIncludedItems,
    resolvedExcludedItems,
    resolvedOptionalTours,
    resolvedOptionalExpenses,
  };
}
