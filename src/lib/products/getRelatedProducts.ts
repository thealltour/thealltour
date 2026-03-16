import type { Product } from "@/types/product";
import {
  sortRelatedProducts,
  scoreRelatedProduct,
  MIN_RELATED_SCORE,
} from "@/lib/products/relatedProductScoring";

export type GetRelatedProductsParams = {
  currentProduct?: Product | null;
  allProducts?: Product[];
  limit?: number;
};

/**
 * PR43: 현재 상품 기준 연관 상품 목록 반환.
 * - 현재 상품 제외
 * - 관련도(destination_id > theme > category/product_line_id) 순 정렬
 * - score가 MIN_RELATED_SCORE 미만인 상품 제외 후, 부족분은 fallback으로 채움
 */
export function getRelatedProducts({
  currentProduct,
  allProducts,
  limit = 6,
}: GetRelatedProductsParams): Product[] {
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
