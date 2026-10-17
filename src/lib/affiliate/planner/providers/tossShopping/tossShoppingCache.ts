import type { TossCategoryBestProduct } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import {
  TOSS_CATEGORY_BEST_TTL_MS,
  TOSS_SHARELINK_TTL_MS,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

type MemoryEntry<T> = {
  payload: T;
  expiresAt: number;
};

export type TossShoppingCacheStore = {
  readCategoryBest: (categoryId: number) => Promise<TossCategoryBestProduct[] | null>;
  writeCategoryBest: (
    categoryId: number,
    products: TossCategoryBestProduct[],
    ttlMs?: number,
  ) => Promise<void>;
  readSharelink: (key: string) => Promise<string | null>;
  writeSharelink: (key: string, targetUrl: string, ttlMs?: number) => Promise<void>;
};

export function tossSharelinkCacheKey(tacaItemId: number, publisherId: string): string {
  return `sharelink:${publisherId}:${tacaItemId}`;
}

export function createMemoryTossShoppingCache(): TossShoppingCacheStore {
  const categoryBest = new Map<number, MemoryEntry<TossCategoryBestProduct[]>>();
  const sharelinks = new Map<string, MemoryEntry<string>>();

  return {
    async readCategoryBest(categoryId) {
      const hit = categoryBest.get(categoryId);
      if (!hit || hit.expiresAt <= Date.now()) return null;
      return hit.payload;
    },
    async writeCategoryBest(categoryId, products, ttlMs = TOSS_CATEGORY_BEST_TTL_MS) {
      categoryBest.set(categoryId, {
        payload: products,
        expiresAt: Date.now() + ttlMs,
      });
    },
    async readSharelink(key) {
      const hit = sharelinks.get(key);
      if (!hit || hit.expiresAt <= Date.now()) return null;
      return hit.payload;
    },
    async writeSharelink(key, targetUrl, ttlMs = TOSS_SHARELINK_TTL_MS) {
      sharelinks.set(key, {
        payload: targetUrl,
        expiresAt: Date.now() + ttlMs,
      });
    },
  };
}

let defaultCache: TossShoppingCacheStore | null = null;

export function getDefaultTossShoppingCache(): TossShoppingCacheStore {
  if (!defaultCache) defaultCache = createMemoryTossShoppingCache();
  return defaultCache;
}

/** Test-only. */
export function __resetTossShoppingCacheForTests(): void {
  defaultCache = createMemoryTossShoppingCache();
}
