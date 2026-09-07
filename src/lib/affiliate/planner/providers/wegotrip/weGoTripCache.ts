import {
  WEGOTRIP_CAPABILITIES_TTL_MS,
  WEGOTRIP_CITY_TTL_MS,
  WEGOTRIP_PRODUCTS_TTL_MS,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";

export type WeGoTripCacheStore = {
  readFresh: <T>(cacheKey: string) => Promise<T | null>;
  readStale: <T>(cacheKey: string) => Promise<T | null>;
  write: (
    cacheKey: string,
    kind: string,
    payload: unknown,
    ttlMs: number,
  ) => Promise<void>;
};

export function createMemoryWeGoTripCache(): WeGoTripCacheStore {
  const map = new Map<string, { payload: unknown; expiresAt: number }>();
  return {
    async readFresh(cacheKey) {
      const hit = map.get(cacheKey);
      if (!hit || hit.expiresAt <= Date.now()) return null;
      return hit.payload as never;
    },
    async readStale(cacheKey) {
      const hit = map.get(cacheKey);
      return (hit?.payload as never) ?? null;
    },
    async write(cacheKey, _kind, payload, ttlMs) {
      map.set(cacheKey, { payload, expiresAt: Date.now() + ttlMs });
    },
  };
}

export function weGoTripCityCacheKey(query: string): string {
  return `city:${normalizeCacheQuery(query)}`;
}

export function weGoTripProductsCacheKey(params: {
  cityId: number;
  lang: string;
  currency: string;
}): string {
  return `products:${params.cityId}:${params.lang}:${params.currency}`;
}

export const WEGOTRIP_CAPABILITIES_CACHE_KEY = "capabilities:v1";

export {
  WEGOTRIP_CITY_TTL_MS,
  WEGOTRIP_PRODUCTS_TTL_MS,
  WEGOTRIP_CAPABILITIES_TTL_MS,
};

function normalizeCacheQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
