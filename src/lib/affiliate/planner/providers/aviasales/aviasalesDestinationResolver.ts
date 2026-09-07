import "server-only";

import {
  fetchAviasalesAutocomplete,
  isValidIataCode,
  normalizeIataCode,
  resolveDefaultAviasalesCache,
  type AviasalesAutocompleteClientDeps,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";
import {
  AVIASALES_PLACE_NEGATIVE_TTL_MS,
  AVIASALES_PLACE_TTL_MS,
  AVIASALES_NEGATIVE_PLACE_SENTINEL,
  aviasalesPlaceCacheKey,
  isAviasalesNegativePlace,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import type {
  AviasalesAutocompletePlace,
  AviasalesResolvedIata,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";

/**
 * Resolve location text → IATA via autocomplete.
 * Prefer city over airport; airport maps to city_code when present.
 * No hardcoded city→IATA map (e.g. Seoul→SEL, Osaka→OSA).
 * Used for both origin and destination.
 */
export async function resolveAviasalesLocationIata(params: {
  locationText: string;
  countryCode?: string | null;
  deps?: AviasalesAutocompleteClientDeps;
}): Promise<AviasalesResolvedIata | null> {
  return resolveAviasalesDestinationIata({
    destinationText: params.locationText,
    countryCode: params.countryCode,
    deps: params.deps,
  });
}

/**
 * @deprecated Prefer resolveAviasalesLocationIata — same resolver for origin/destination.
 */
export async function resolveAviasalesDestinationIata(params: {
  destinationText: string;
  countryCode?: string | null;
  deps?: AviasalesAutocompleteClientDeps;
}): Promise<AviasalesResolvedIata | null> {
  const query = params.destinationText.trim();
  if ([...query].length < 2) return null;

  // Already a bare IATA — accept without network when well-formed.
  if (isValidIataCode(query) && [...query].length === 3) {
    return {
      iata: normalizeIataCode(query),
      name: normalizeIataCode(query),
      type: "city",
      countryCode: params.countryCode?.toUpperCase() ?? null,
      sourceCode: normalizeIataCode(query),
    };
  }

  const cache = await resolveDefaultAviasalesCache(params.deps);
  const countryCode = params.countryCode?.trim().toUpperCase() || null;

  for (const locale of ["ko", "en"] as const) {
    const cacheKey = aviasalesPlaceCacheKey({ query, locale, countryCode });
    const fresh = await cache.readFresh<unknown>(cacheKey);
    if (fresh) {
      if (isAviasalesNegativePlace(fresh)) continue;
      if (isResolvedIata(fresh)) return fresh;
    }

    const result = await fetchAviasalesAutocomplete({
      term: query,
      locale,
      deps: params.deps,
    });

    if (!result.ok) {
      const stale = await cache.readStale<unknown>(cacheKey);
      if (stale && !isAviasalesNegativePlace(stale.payload) && isResolvedIata(stale.payload)) {
        return stale.payload;
      }
      continue;
    }

    const picked = pickBestPlace(result.data, { query, countryCode });
    if (!picked) {
      await cache.write(
        cacheKey,
        "place_negative",
        AVIASALES_NEGATIVE_PLACE_SENTINEL,
        AVIASALES_PLACE_NEGATIVE_TTL_MS,
      );
      continue;
    }

    const resolved = toResolvedIata(picked);
    await cache.write(cacheKey, "place", resolved, AVIASALES_PLACE_TTL_MS);
    return resolved;
  }

  return null;
}

export function pickBestPlace(
  places: AviasalesAutocompletePlace[],
  params: { query: string; countryCode?: string | null },
): AviasalesAutocompletePlace | null {
  if (places.length === 0) return null;
  const q = params.query.trim().toLowerCase();
  const country = params.countryCode?.trim().toUpperCase() || null;

  const scored = places.map((place) => {
    let score = 0;
    // City preferred over airport.
    if (place.type === "city") score += 1_000_000;
    else score += 100_000;

    if (country && place.countryCode === country) score += 50_000;

    const name = place.name.toLowerCase();
    const cityName = (place.cityName ?? "").toLowerCase();
    if (name === q || cityName === q) score += 20_000;
    else if (name.startsWith(q) || cityName.startsWith(q)) score += 10_000;
    else if (name.includes(q) || cityName.includes(q)) score += 5_000;

    score += Math.max(0, Math.min(place.weight, 40_000));
    return { place, score };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    // Stable code tie-break (lexical ascending).
    const codeA = effectiveIata(a.place);
    const codeB = effectiveIata(b.place);
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return a.place.code.localeCompare(b.place.code);
  });

  return scored[0]?.place ?? null;
}

export function toResolvedIata(place: AviasalesAutocompletePlace): AviasalesResolvedIata {
  const iata = effectiveIata(place);
  return {
    iata,
    name: place.type === "airport" && place.cityName ? place.cityName : place.name,
    type: place.type === "airport" && place.cityCode ? "city" : place.type,
    countryCode: place.countryCode,
    sourceCode: place.code,
  };
}

function effectiveIata(place: AviasalesAutocompletePlace): string {
  if (place.type === "airport" && place.cityCode && isValidIataCode(place.cityCode)) {
    return normalizeIataCode(place.cityCode);
  }
  return normalizeIataCode(place.code);
}

function isResolvedIata(v: unknown): v is AviasalesResolvedIata {
  if (!v || typeof v !== "object") return false;
  const o = v as AviasalesResolvedIata;
  return isValidIataCode(o.iata) && typeof o.name === "string" && !!o.name;
}
