import "server-only";

import {
  isValidIataCode,
  normalizeIataCode,
  resolveDefaultAviasalesCache,
  type AviasalesAutocompleteClientDeps,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";
import {
  AVIASALES_PRICE_TTL_MS,
  aviasalesPriceCacheKey,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  AVIASALES_DEFAULT_CURRENCY,
  AVIASALES_PRICE_STALE_MAX_AGE_MS,
  AVIASALES_PRICES_FOR_DATES_URL,
  AVIASALES_TIMEOUT_MS,
  type AviasalesClientErrorCode,
  type AviasalesPriceOffer,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";

export type AviasalesDataClientDeps = AviasalesAutocompleteClientDeps & {
  /** Inject token for tests; default reads TRAVELPAYOUTS_API_TOKEN. */
  getApiToken?: () => string | null;
};

type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: AviasalesClientErrorCode };

export type FetchPricesForDatesParams = {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt?: string | null;
  currency?: string;
  oneWay?: boolean;
  limit?: number;
  deps?: AviasalesDataClientDeps;
};

/**
 * GET aviasales/v3/prices_for_dates — NEVER call without explicit origin IATA.
 * Flexible / grouped_prices intentionally not implemented in this foundation.
 */
export async function fetchAviasalesPricesForDates(
  params: FetchPricesForDatesParams,
): Promise<ClientResult<AviasalesPriceOffer[]>> {
  if (!isValidIataCode(params.origin)) {
    return { ok: false, errorCode: "missing_origin" };
  }
  if (!isValidIataCode(params.destination)) {
    return { ok: false, errorCode: "invalid_response" };
  }
  if (!isIsoDateOrMonth(params.departureAt)) {
    return { ok: false, errorCode: "invalid_response" };
  }

  const origin = normalizeIataCode(params.origin);
  const destination = normalizeIataCode(params.destination);
  const currency = (params.currency ?? AVIASALES_DEFAULT_CURRENCY).toLowerCase();
  const oneWay = params.oneWay ?? !params.returnAt;
  const returnAt =
    !oneWay && params.returnAt && isIsoDateOrMonth(params.returnAt)
      ? params.returnAt
      : null;

  const cache = await resolveDefaultAviasalesCache(params.deps);
  const cacheKey = aviasalesPriceCacheKey({
    origin,
    destination,
    departureAt: params.departureAt,
    returnAt,
    currency,
    oneWay,
  });

  const fresh = await cache.readFresh<AviasalesPriceOffer[]>(cacheKey);
  if (fresh && Array.isArray(fresh)) return { ok: true, data: fresh };

  const token = resolveApiToken(params.deps);
  if (!token) return { ok: false, errorCode: "config_missing" };

  const url = new URL(AVIASALES_PRICES_FOR_DATES_URL);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_at", params.departureAt);
  if (returnAt) url.searchParams.set("return_at", returnAt);
  url.searchParams.set("one_way", oneWay ? "true" : "false");
  url.searchParams.set("currency", currency);
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", String(Math.min(params.limit ?? 30, 100)));
  url.searchParams.set("page", "1");
  url.searchParams.set("token", token);

  const controller = new AbortController();
  const timeoutMs = params.deps?.timeoutMs ?? AVIASALES_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchImpl = params.deps?.fetchImpl ?? fetch;
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.info("[aviasales] prices_http_error", {
        providerId: "aviasales",
        operation: "prices_for_dates",
        errorCode: `http_${res.status}`,
        hostname: "api.travelpayouts.com",
      });
      return staleOrError(cache, cacheKey, "http_error");
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return staleOrError(cache, cacheKey, "invalid_response");
    }

    const parsed = parsePricesForDatesResponse(json);
    if (!parsed.ok) {
      return staleOrError(cache, cacheKey, parsed.errorCode);
    }

    await cache.write(cacheKey, "prices", parsed.data, AVIASALES_PRICE_TTL_MS);
    return { ok: true, data: parsed.data };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed";
    console.info("[aviasales] prices_failed", {
      providerId: "aviasales",
      operation: "prices_for_dates",
      errorCode: code,
      hostname: "api.travelpayouts.com",
    });
    return staleOrError(cache, cacheKey, code);
  } finally {
    clearTimeout(timer);
  }
}

export function parsePricesForDatesResponse(
  json: unknown,
): ClientResult<AviasalesPriceOffer[]> {
  const root = asRecord(json);
  if (!root) return { ok: false, errorCode: "invalid_response" };
  if (root.success === false) return { ok: false, errorCode: "invalid_response" };

  const rows = Array.isArray(root.data) ? root.data : null;
  if (!rows) return { ok: false, errorCode: "invalid_response" };

  const offers: AviasalesPriceOffer[] = [];
  for (const row of rows) {
    const offer = parsePriceOffer(row);
    if (offer) offers.push(offer);
  }
  return { ok: true, data: offers };
}

export function parsePriceOffer(row: unknown): AviasalesPriceOffer | null {
  const o = asRecord(row);
  if (!o) return null;
  if (!isValidIataCode(o.origin) || !isValidIataCode(o.destination)) return null;
  const price = typeof o.price === "number" && Number.isFinite(o.price) ? o.price : NaN;
  if (!(price >= 0)) return null;
  const link = typeof o.link === "string" ? o.link.trim() : "";
  if (!link.startsWith("/")) return null;

  return {
    origin: normalizeIataCode(o.origin),
    destination: normalizeIataCode(o.destination),
    originAirport: isValidIataCode(o.origin_airport)
      ? normalizeIataCode(o.origin_airport)
      : null,
    destinationAirport: isValidIataCode(o.destination_airport)
      ? normalizeIataCode(o.destination_airport)
      : null,
    price,
    airline: typeof o.airline === "string" ? o.airline.trim() || null : null,
    flightNumber:
      typeof o.flight_number === "string" || typeof o.flight_number === "number"
        ? String(o.flight_number).trim() || null
        : null,
    departureAt: typeof o.departure_at === "string" ? o.departure_at : null,
    returnAt: typeof o.return_at === "string" ? o.return_at : null,
    transfers:
      typeof o.transfers === "number" && Number.isFinite(o.transfers) ? o.transfers : null,
    link,
  };
}

function resolveApiToken(deps?: AviasalesDataClientDeps): string | null {
  if (deps?.getApiToken) {
    const t = deps.getApiToken()?.trim() ?? "";
    return t || null;
  }
  // Same token as getTravelpayoutsConfig().apiToken / Partner Links (TRAVELPAYOUTS_API_TOKEN).
  const fromEnv = process.env.TRAVELPAYOUTS_API_TOKEN?.trim() ?? "";
  return fromEnv || null;
}

async function staleOrError(
  cache: Awaited<ReturnType<typeof resolveDefaultAviasalesCache>>,
  cacheKey: string,
  errorCode: AviasalesClientErrorCode,
): Promise<ClientResult<AviasalesPriceOffer[]>> {
  const stale = await cache.readStale<AviasalesPriceOffer[]>(cacheKey);
  if (
    stale &&
    Array.isArray(stale.payload) &&
    stale.fetchedAt > 0 &&
    Date.now() - stale.fetchedAt <= AVIASALES_PRICE_STALE_MAX_AGE_MS
  ) {
    return { ok: true, data: stale.payload };
  }
  return { ok: false, errorCode };
}

function isIsoDateOrMonth(raw: string): boolean {
  return /^\d{4}-\d{2}(-\d{2})?$/.test(raw.trim());
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
