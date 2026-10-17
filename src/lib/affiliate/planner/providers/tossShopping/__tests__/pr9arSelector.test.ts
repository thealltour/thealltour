import { describe, expect, it } from "vitest";
import { selectTossTravelGoodsCandidates } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingSelector";
import type { TossCategoryBestProduct } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

function product(
  overrides: Partial<TossCategoryBestProduct> & Pick<TossCategoryBestProduct, "tacaItemId">,
): TossCategoryBestProduct {
  return {
    displayName: `P-${overrides.tacaItemId}`,
    rank: 10,
    displayPrice: 10000,
    originalPrice: 12000,
    discountRate: 10,
    isSoldOut: false,
    thumbnailUrl: null,
    reviewScore: 4.0,
    reviewCount: 10,
    categoryIds: [1],
    productUrl: null,
    ...overrides,
  };
}

describe("PR-9AR Toss selector ranking", () => {
  it("drops sold-out products", () => {
    const ranked = selectTossTravelGoodsCandidates([
      product({ tacaItemId: 1, rank: 1, isSoldOut: true }),
      product({ tacaItemId: 2, rank: 2, isSoldOut: false }),
    ]);
    expect(ranked.map((p) => p.tacaItemId)).toEqual([2]);
  });

  it("orders by rank asc first", () => {
    const ranked = selectTossTravelGoodsCandidates([
      product({ tacaItemId: 2, rank: 5 }),
      product({ tacaItemId: 1, rank: 1 }),
      product({ tacaItemId: 3, rank: 3 }),
    ]);
    expect(ranked.map((p) => p.tacaItemId)).toEqual([1, 3, 2]);
  });

  it("breaks rank ties by reviewCount desc", () => {
    const ranked = selectTossTravelGoodsCandidates([
      product({ tacaItemId: 1, rank: 1, reviewCount: 10 }),
      product({ tacaItemId: 2, rank: 1, reviewCount: 50 }),
    ]);
    expect(ranked.map((p) => p.tacaItemId)).toEqual([2, 1]);
  });

  it("then reviewScore, discountRate, displayPrice, stable tacaItemId", () => {
    const ranked = selectTossTravelGoodsCandidates([
      product({
        tacaItemId: 30,
        rank: 1,
        reviewCount: 10,
        reviewScore: 4.0,
        discountRate: 10,
        displayPrice: 9000,
      }),
      product({
        tacaItemId: 10,
        rank: 1,
        reviewCount: 10,
        reviewScore: 4.5,
        discountRate: 5,
        displayPrice: 8000,
      }),
      product({
        tacaItemId: 20,
        rank: 1,
        reviewCount: 10,
        reviewScore: 4.5,
        discountRate: 20,
        displayPrice: 8000,
      }),
      product({
        tacaItemId: 11,
        rank: 1,
        reviewCount: 10,
        reviewScore: 4.5,
        discountRate: 20,
        displayPrice: 7000,
      }),
      product({
        tacaItemId: 12,
        rank: 1,
        reviewCount: 10,
        reviewScore: 4.5,
        discountRate: 20,
        displayPrice: 7000,
      }),
    ]);
    expect(ranked.map((p) => p.tacaItemId)).toEqual([11, 12, 20, 10, 30]);
  });
});
