/**
 * WeGoTrip API types — fixed to v2 after live smoke
 * (v3 /search returned 404; v2 search/products/currencies OK).
 */

export const WEGOTRIP_API_BASE_URL = "https://app.wegotrip.com/api/v2";
export const WEGOTRIP_API_VERSION = "v2" as const;

export const WEGOTRIP_TIMEOUT_MS = 7_000;
export const WEGOTRIP_ALLOWED_HOSTS = ["wegotrip.com"] as const;

/** City identity TTL: 14 days — city ids/slugs are stable. */
export const WEGOTRIP_CITY_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Popular products TTL: 12h. */
export const WEGOTRIP_PRODUCTS_TTL_MS = 12 * 60 * 60 * 1000;
/** Languages/currencies capability TTL: 7 days. */
export const WEGOTRIP_CAPABILITIES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WeGoTripCity = {
  id: number;
  name: string;
  slug: string;
  available?: boolean;
  countryName?: string | null;
};

export type WeGoTripProduct = {
  id: number;
  title: string;
  slug: string;
  available: boolean;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  city: WeGoTripCity;
};

export type WeGoTripCapabilities = {
  languages: string[];
  currencies: string[];
  languagesEndpointOk: boolean;
  preferredLang: "ko" | "en";
  preferredCurrency: string;
};

export type WeGoTripClientErrorCode =
  | "timeout"
  | "network_failed"
  | "http_error"
  | "invalid_response"
  | "query_too_short";
