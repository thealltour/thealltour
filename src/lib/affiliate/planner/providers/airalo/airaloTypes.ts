/**
 * Airalo Travelpayouts NEW feed — normalized server-only records.
 * Feed source: Travelpayouts Airalo Tools → "New feed" download URL
 * (set via AIRALO_FEED_URL). RSS 2.0 + Google Merchant fields only;
 * no invented XML countryCode attribute. g:link is product sourceUrl
 * (must be converted via Travelpayouts Partner Links / commerce core).
 */

export type AiraloOfferRecord = {
  id: string;
  title: string;
  /** Product page URL from g:link — NOT an affiliate URL. */
  sourceUrl: string;
  /** Derived from product_type COUNTRY segment — never a fabricated feed field. */
  countryCode: string | null;
  price: number | null;
  salePrice: number | null;
  currency: string | null;
  availability: string | null;
  productType: string | null;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  isBundle: boolean | null;
  mpn: string | null;
};

export type AiraloParseResult =
  | { ok: true; records: AiraloOfferRecord[] }
  | { ok: false; errorCode: "invalid_xml" | "empty_feed" | "unsupported_format" };

export const AIRALO_ALLOWED_HOSTS = ["airalo.com", "www.airalo.com"] as const;

/** Catalog TTL: 12h — feed updates are infrequent; balances freshness vs download cost. */
export const AIRALO_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

export const AIRALO_FEED_TIMEOUT_MS = 10_000;

export const AIRALO_FEED_MAX_BYTES = 25 * 1024 * 1024;

export const AIRALO_CATALOG_CACHE_KEY = "catalog:v1";

/** Optional Travelpayouts Airalo campaign marker (docs: campaign_id=541). */
export const AIRALO_DEFAULT_CAMPAIGN_ID = "541";
