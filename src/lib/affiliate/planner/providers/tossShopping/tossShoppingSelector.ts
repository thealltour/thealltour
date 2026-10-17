import type { TossCategoryBestProduct } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

/**
 * Deterministic category-best ordering (PR-9AR).
 * Category rank stays authoritative after in-stock filter.
 * No fuzzy name matching / LLM / keyword scoring.
 */
export function selectTossTravelGoodsCandidates(
  products: readonly TossCategoryBestProduct[],
): TossCategoryBestProduct[] {
  return [...products]
    .filter((p) => p.isSoldOut === false)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const reviewCountDiff = (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
      if (reviewCountDiff !== 0) return reviewCountDiff;
      const reviewScoreDiff = (b.reviewScore ?? -1) - (a.reviewScore ?? -1);
      if (reviewScoreDiff !== 0) return reviewScoreDiff;
      const discountDiff = (b.discountRate ?? -1) - (a.discountRate ?? -1);
      if (discountDiff !== 0) return discountDiff;
      const priceA = a.displayPrice ?? Number.POSITIVE_INFINITY;
      const priceB = b.displayPrice ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;
      return a.tacaItemId - b.tacaItemId;
    });
}
