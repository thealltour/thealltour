import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

export const TOSS_TRAVEL_GOODS_SECTION_TITLE = "여행 준비물";
export const TOSS_TRAVEL_GOODS_SECTION_DESCRIPTION =
  "여행 전에 챙겨두면 좋은 준비물을 확인해 보세요.";

export type TossTravelGoodsCategoryEntry = {
  readonly intent: TossTravelGoodsIntent;
  readonly categoryId: number;
  readonly labelKo: string;
};

/**
 * Curated category SSOT (PR-9AR). Readonly — no runtime category-tree fetch.
 * packing_cube / phone_mount / travel_pillow / portable_fan intentionally omitted.
 */
export const TOSS_TRAVEL_GOODS_CATEGORIES = {
  power_bank: {
    intent: "power_bank",
    categoryId: 20037,
    labelKo: "보조배터리",
  },
  waterproof_pouch: {
    intent: "waterproof_pouch",
    categoryId: 20165,
    labelKo: "방수팩",
  },
  luggage: {
    intent: "luggage",
    categoryId: 38067,
    labelKo: "캐리어",
  },
  travel_adapter: {
    intent: "travel_adapter",
    categoryId: 24087,
    labelKo: "여행용 어댑터",
  },
  car_charger: {
    intent: "car_charger",
    categoryId: 31801,
    labelKo: "차량용 충전기",
  },
} as const satisfies Record<TossTravelGoodsIntent, TossTravelGoodsCategoryEntry>;

export function tossCategoryForIntent(
  intent: TossTravelGoodsIntent,
): TossTravelGoodsCategoryEntry {
  return TOSS_TRAVEL_GOODS_CATEGORIES[intent];
}
