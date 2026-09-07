/**
 * Aviasales / Travelpayouts Data API types (v3 prices_for_dates).
 * Autocomplete: https://autocomplete.travelpayouts.com/places2
 * Prices: https://api.travelpayouts.com/aviasales/v3/prices_for_dates
 */

export const AVIASALES_AUTOCOMPLETE_URL =
  "https://autocomplete.travelpayouts.com/places2";
export const AVIASALES_PRICES_FOR_DATES_URL =
  "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

export const AVIASALES_TIMEOUT_MS = 8_000;
export const AVIASALES_ALLOWED_HOSTS = ["aviasales.com", "www.aviasales.com"] as const;

/** Search page base — Data API `link` is a path like `/search/...`. */
export const AVIASALES_SEARCH_ORIGIN = "https://www.aviasales.com";

/** IATA / place identity TTL: 14 days. */
export const AVIASALES_PLACE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Negative autocomplete miss TTL: 1 hour. */
export const AVIASALES_PLACE_NEGATIVE_TTL_MS = 60 * 60 * 1000;
/** Price quote TTL: 2 hours (within 30m–6h). */
export const AVIASALES_PRICE_TTL_MS = 2 * 60 * 60 * 1000;
/** Stale price usable up to 12h after fetch for limited fallback. */
export const AVIASALES_PRICE_STALE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Default quote currency — USD (no FX). KRW not assumed without live confirm. */
export const AVIASALES_DEFAULT_CURRENCY = "usd";

export type AviasalesPlaceType = "city" | "airport";

export type AviasalesAutocompletePlace = {
  type: AviasalesPlaceType;
  code: string;
  name: string;
  countryCode: string | null;
  cityCode: string | null;
  cityName: string | null;
  weight: number;
};

/** Canonical IATA used for Data API origin/destination (prefer city code). */
export type AviasalesResolvedIata = {
  iata: string;
  name: string;
  type: AviasalesPlaceType;
  countryCode: string | null;
  sourceCode: string;
};

/**
 * Normalized prices_for_dates row — fields confirmed by Travelpayouts Help Center.
 * Do not invent GraphQL/Search API ticket fields.
 */
export type AviasalesPriceOffer = {
  origin: string;
  destination: string;
  originAirport: string | null;
  destinationAirport: string | null;
  price: number;
  airline: string | null;
  flightNumber: string | null;
  departureAt: string | null;
  returnAt: string | null;
  transfers: number | null;
  link: string;
};

export type AviasalesClientErrorCode =
  | "timeout"
  | "network_failed"
  | "http_error"
  | "invalid_response"
  | "config_missing"
  | "missing_origin"
  | "query_too_short"
  | "not_found";
