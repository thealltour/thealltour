import "server-only";

import {
  searchWeGoTrip,
  type WeGoTripClientDeps,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripClient";
import {
  WEGOTRIP_CITY_TTL_MS,
  weGoTripCityCacheKey,
  type WeGoTripCacheStore,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripCache";
import type { WeGoTripCity } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";

async function defaultWeGoTripCache(): Promise<WeGoTripCacheStore> {
  const mod = await import(
    "@/lib/affiliate/planner/providers/wegotrip/weGoTripCacheSupabase"
  );
  return mod.supabaseWeGoTripCache;
}

/**
 * Resolve Planner destination text → WeGoTrip city via /search/.
 * Deterministic: exact name match (case-insensitive) → else lowest id among cities.
 */
export async function resolveWeGoTripCity(params: {
  destinationText: string;
  deps?: WeGoTripClientDeps;
}): Promise<WeGoTripCity | null> {
  const query = params.destinationText.trim();
  if ([...query].length < 3) return null;

  const cache = params.deps?.cache ?? (await defaultWeGoTripCache());
  const cacheKey = weGoTripCityCacheKey(query);
  const fresh = await cache.readFresh<WeGoTripCity>(cacheKey);
  if (fresh && typeof fresh.id === "number") return fresh;

  const search = await searchWeGoTrip({ query, deps: params.deps });
  if (!search.ok) {
    const stale = await cache.readStale<WeGoTripCity>(cacheKey);
    return stale && typeof stale.id === "number" ? stale : null;
  }

  const city = pickCity(search.data.cities, query);
  if (!city) return null;
  await cache.write(cacheKey, "city", city, WEGOTRIP_CITY_TTL_MS);
  return city;
}

export function pickCity(cities: WeGoTripCity[], query: string): WeGoTripCity | null {
  const available = cities.filter((c) => c.available !== false);
  if (available.length === 0) return null;

  const q = query.trim().toLowerCase();
  const exact = available
    .filter((c) => c.name.toLowerCase() === q || c.slug.toLowerCase() === q)
    .sort((a, b) => a.id - b.id);
  if (exact.length > 0) return exact[0]!;

  const starts = available
    .filter(
      (c) =>
        c.name.toLowerCase().startsWith(q) || c.slug.toLowerCase().startsWith(q),
    )
    .sort((a, b) => a.id - b.id);
  if (starts.length > 0) return starts[0]!;

  return [...available].sort((a, b) => a.id - b.id)[0] ?? null;
}
