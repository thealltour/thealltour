import type { AiraloOfferRecord } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";
import {
  AIRALO_CATALOG_CACHE_KEY,
  AIRALO_CATALOG_TTL_MS,
} from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

export type AiraloCatalogCacheStore = {
  readFresh: (cacheKey: string) => Promise<AiraloOfferRecord[] | null>;
  readStale: (cacheKey: string) => Promise<AiraloOfferRecord[] | null>;
  write: (
    cacheKey: string,
    records: AiraloOfferRecord[],
    ttlMs?: number,
  ) => Promise<void>;
};

export function isAiraloRecordArray(raw: unknown): raw is AiraloOfferRecord[] {
  if (!Array.isArray(raw)) return false;
  return raw.every(
    (row) =>
      !!row &&
      typeof row === "object" &&
      typeof (row as AiraloOfferRecord).id === "string" &&
      typeof (row as AiraloOfferRecord).title === "string" &&
      typeof (row as AiraloOfferRecord).sourceUrl === "string",
  );
}

export function createMemoryAiraloCatalogCache(): AiraloCatalogCacheStore {
  const map = new Map<
    string,
    { records: AiraloOfferRecord[]; expiresAt: number; fetchedAt: number }
  >();
  return {
    async readFresh(cacheKey) {
      const hit = map.get(cacheKey);
      if (!hit || hit.expiresAt <= Date.now()) return null;
      return hit.records;
    },
    async readStale(cacheKey) {
      return map.get(cacheKey)?.records ?? null;
    },
    async write(cacheKey, records, ttlMs = AIRALO_CATALOG_TTL_MS) {
      map.set(cacheKey, {
        records,
        expiresAt: Date.now() + ttlMs,
        fetchedAt: Date.now(),
      });
    },
  };
}

export { AIRALO_CATALOG_CACHE_KEY, AIRALO_CATALOG_TTL_MS };
