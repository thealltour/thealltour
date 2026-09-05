import "server-only";

import type { PlacesCandidate } from "@/lib/planner/placesQuery";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri";

export function getGoogleMapsApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    null
  );
}

export class PlacesProviderError extends Error {
  readonly category: "missing_key" | "http" | "network" | "parse";

  constructor(category: PlacesProviderError["category"], message: string) {
    super(message);
    this.name = "PlacesProviderError";
    this.category = category;
  }
}

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  googleMapsUri?: string;
};

/**
 * Google Places API (New) Text Search — server only.
 * FieldMask is minimal (no rating/reviews/photos/openingHours).
 */
export async function searchPlacesText(params: {
  textQuery: string;
  languageCode?: string;
  maxResultCount?: number;
}): Promise<PlacesCandidate[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new PlacesProviderError("missing_key", "GOOGLE_MAPS_API_KEY is not configured");
  }

  const query = params.textQuery.trim();
  if (!query) return [];

  let res: Response;
  try {
    res = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: params.languageCode ?? "ko",
        maxResultCount: Math.min(Math.max(params.maxResultCount ?? 5, 1), 10),
      }),
      cache: "no-store",
    });
  } catch {
    throw new PlacesProviderError("network", "Places network error");
  }

  if (!res.ok) {
    throw new PlacesProviderError("http", `Places HTTP ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new PlacesProviderError("parse", "Places JSON parse failed");
  }

  const places = (json as { places?: PlacesApiPlace[] }).places;
  if (!Array.isArray(places)) return [];

  const out: PlacesCandidate[] = [];
  for (const p of places) {
    const placeId = typeof p.id === "string" ? p.id.trim() : "";
    const displayName = typeof p.displayName?.text === "string" ? p.displayName.text.trim() : "";
    const formattedAddress =
      typeof p.formattedAddress === "string" ? p.formattedAddress.trim() : "";
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!placeId || !displayName) continue;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    out.push({
      placeId,
      displayName,
      formattedAddress,
      lat,
      lng,
      types: Array.isArray(p.types) ? p.types.filter((t): t is string => typeof t === "string") : [],
      googleMapsUri: typeof p.googleMapsUri === "string" ? p.googleMapsUri : null,
    });
  }
  return out;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!, idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
