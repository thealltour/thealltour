import {
  sortRelatedProducts,
  scoreRelatedProduct,
  MIN_RELATED_SCORE,
  type RelatedScorableProduct,
} from "@/lib/products/relatedProductScoring";

export type GetRelatedProductsParams<T extends RelatedScorableProduct = RelatedScorableProduct> = {
  currentProduct?: RelatedScorableProduct | null;
  allProducts?: T[];
  limit?: number;
};

/**
 * PR43 / POST-UI-01D-2B-1: 현재 상품 기준 연관 상품 목록 반환 (sync scoring).
 * - 현재 상품 제외
 * - 관련도 정렬 + MIN_RELATED_SCORE 매칭 후, 부족분은 동일 sorted universe fallback
 * Stage-1 output: ordered candidates (caller maps to IDs for listing fetch).
 */
export function getRelatedProducts<T extends RelatedScorableProduct>({
  currentProduct,
  allProducts,
  limit = 6,
}: GetRelatedProductsParams<T>): T[] {
  if (!currentProduct?.id?.trim() || !Array.isArray(allProducts)) {
    return [];
  }
  const sorted = sortRelatedProducts(currentProduct, allProducts);
  const matched = sorted.filter(
    (p) => scoreRelatedProduct(currentProduct, p) >= MIN_RELATED_SCORE,
  );
  const top = matched.slice(0, limit);

  if (top.length >= limit) return top;

  const topIds = new Set(top.map((p) => p.id));
  const fallback = sorted.filter((p) => !topIds.has(p.id));
  return [...top, ...fallback].slice(0, limit);
}

export type { RelatedScorableProduct };
