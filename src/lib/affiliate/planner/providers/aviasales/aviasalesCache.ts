import {
  AVIASALES_PLACE_NEGATIVE_TTL_MS,
  AVIASALES_PLACE_TTL_MS,
  AVIASALES_PRICE_TTL_MS,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";

export type AviasalesCacheStore = {
  readFresh: <T>(cacheKey: string) => Promise<T | null>;
  readStale: <T>(cacheKey: string) => Promise<{ payload: T; fetchedAt: number } | null>;
  write: (
    cacheKey: string,
    kind: string,
    payload: unknown,
    ttlMs: number,
  ) => Promise<void>;
};

type MemoryEntry = {
  payload: unknown;
  expiresAt: number;
  fetchedAt: number;
};

export function createMemoryAviasalesCache(): AviasalesCacheStore {
  const map = new Map<string, MemoryEntry>();
  return {
    async readFresh(cacheKey) {
      const hit = map.get(cacheKey);
      if (!hit || hit.expiresAt <= Date.now()) return null;
      return hit.payload as never;
    },
    async readStale(cacheKey) {
      const hit = map.get(cacheKey);
      if (!hit) return null;
      return { payload: hit.payload as never, fetchedAt: hit.fetchedAt };
    },
    async write(cacheKey, _kind, payload, ttlMs) {
      map.set(cacheKey, {
        payload,
        expiresAt: Date.now() + ttlMs,
        fetchedAt: Date.now(),
      });
    },
  };
}

export function aviasalesPlaceCacheKey(params: {
  query: string;
  locale: string;
  countryCode?: string | null;
}): string {
  const country = (params.countryCode ?? "").trim().toUpperCase() || "_";
  return `place:${params.locale}:${country}:${normalizeCacheQuery(params.query)}`;
}

export function aviasalesPriceCacheKey(params: {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt: string | null;
  currency: string;
  oneWay: boolean;
}): string {
  return [
    "prices",
    params.origin.toUpperCase(),
    params.destination.toUpperCase(),
    params.departureAt,
    params.returnAt ?? "oneway",
    params.currency.toLowerCase(),
    params.oneWay ? "ow" : "rt",
  ].join(":");
}

export const AVIASALES_NEGATIVE_PLACE_SENTINEL = { __negative: true as const };

export function isAviasalesNegativePlace(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { __negative?: unknown }).__negative === true
  );
}

export {
  AVIASALES_PLACE_TTL_MS,
  AVIASALES_PLACE_NEGATIVE_TTL_MS,
  AVIASALES_PRICE_TTL_MS,
};

function normalizeCacheQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
