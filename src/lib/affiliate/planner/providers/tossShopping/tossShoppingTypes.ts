/**
 * Toss Shopping Sharelink — curated travel_goods (PR-9AR).
 * Server-only types/constants. Network boundary: Gabia fixed-IP proxy.
 * No keyword search; category-best only.
 */

export const TOSS_SHOPPING_PROVIDER_ID = "toss_shopping" as const;

/** Production VPS HTTPS proxy (server-only client). Not NEXT_PUBLIC. */
export const TOSS_SHOPPING_PROXY_BASE_URL = "https://toss-api.thealltour.com";

/** Per-request network budget (aligned with other planner providers). */
export const TOSS_SHOPPING_TIMEOUT_MS = 6_000;

/** Category-best rankings refresh roughly hourly — do not poll faster. */
export const TOSS_CATEGORY_BEST_TTL_MS = 60 * 60 * 1000;

/** Sharelink reuse is stable for the same product; keep long. */
export const TOSS_SHARELINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Bounded parallel intent fetches (max 3 intents / trip). */
export const TOSS_INTENT_CONCURRENCY = 2;

/** Detail revalidation candidates per intent. */
export const TOSS_DETAIL_CANDIDATE_LIMIT = 3;

/** Reasonable page size for category-best (avoid bulk catalog pulls). */
export const TOSS_CATEGORY_BEST_SIZE = 10;

/** Exact Sharelink host allowlist (live smoke: toss.shopping). */
export const TOSS_SHARELINK_ALLOWED_HOSTS = ["toss.shopping"] as const;

/** Exact Next/Image + metadata image host (live smoke). */
export const TOSS_PRODUCT_IMAGE_HOST = "shopping.toss.im";

export const TOSS_TRAVEL_GOODS_INTENTS = [
  "power_bank",
  "waterproof_pouch",
  "luggage",
  "travel_adapter",
  "car_charger",
] as const;

export type TossTravelGoodsIntent = (typeof TOSS_TRAVEL_GOODS_INTENTS)[number];

export type TossCategoryBestProduct = {
  tacaItemId: number;
  displayName: string;
  rank: number;
  displayPrice: number | null;
  originalPrice: number | null;
  discountRate: number | null;
  isSoldOut: boolean;
  thumbnailUrl: string | null;
  reviewScore: number | null;
  reviewCount: number | null;
  categoryIds: number[];
  productUrl: string | null;
};

export type TossProductDetail = {
  tacaItemId: number;
  displayName: string;
  isSoldOut: boolean;
  thumbnailUrl: string | null;
  reviewScore: number | null;
  reviewCount: number | null;
  displayPrice: number | null;
  originalPrice: number | null;
  discountRate: number | null;
};

export type TossSharelinkResult = {
  shortUrl: string | null;
  originUrl: string | null;
  targetUrl: string;
};
