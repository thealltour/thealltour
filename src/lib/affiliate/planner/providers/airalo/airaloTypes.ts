/**
 * Airalo Travelpayouts NEW feed — normalized server-only records.
 * Feed source: Travelpayouts Airalo Tools → "New feed" download URL
 * (set via AIRALO_FEED_URL). RSS 2.0 + Google Merchant fields only;
 * no invented XML countryCode attribute. g:link is the Travelpayouts-documented target page
 * (an https://airalo.pxf.io/... link) and is passed verbatim to Partner Links / commerce core —
 * never unwrapped to its `u=` www.airalo.com URL.
 */

export type AiraloOfferRecord = {
  id: string;
  title: string;
  /** g:link exactly as published (target page for Partner Links) — NOT the final affiliate URL. */
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
  /**
   * Normalized data allowance from the product_type VOLUME segment ("10GB", "500MB", "Unlimited").
   * Optional: catalogs cached before PR-9AO lack it — read via resolveAiraloPlanDetails.
   */
  dataLabel?: string | null;
  /** Validity in days from the product_type DAYS segment; null when unparseable. */
  validityDays?: number | null;
};

/** Google Merchant availability values recognised as-is; anything else normalizes to null. */
export const AIRALO_AVAILABILITY_VALUES = [
  "in stock",
  "out of stock",
  "preorder",
  "backorder",
] as const;

export type AiraloAvailability = (typeof AIRALO_AVAILABILITY_VALUES)[number];

/** Domestic Korea trips get no eSIM offer (TheAllTour users are Korea-based). */
export const AIRALO_EXCLUDED_COUNTRY_CODES: readonly string[] = ["KR"];

export type AiraloParseResult =
  | { ok: true; records: AiraloOfferRecord[] }
  | { ok: false; errorCode: "invalid_xml" | "empty_feed" | "unsupported_format" };

/**
 * Source hosts accepted by Commerce Core. The live new feed publishes every g:link on
 * airalo.pxf.io; only that exact Airalo host is listed — never pxf.io or *.pxf.io.
 */
export const AIRALO_ALLOWED_HOSTS = ["airalo.com", "www.airalo.com", "airalo.pxf.io"] as const;

/** Catalog TTL: 12h — feed updates are infrequent; balances freshness vs download cost. */
export const AIRALO_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

/** In-process hold for a stale-fallback catalog, so a feed outage is not retried on every request. */
export const AIRALO_STALE_MEMORY_TTL_MS = 5 * 60 * 1000;

export const AIRALO_FEED_TIMEOUT_MS = 10_000;

export const AIRALO_FEED_MAX_BYTES = 25 * 1024 * 1024;

export const AIRALO_CATALOG_CACHE_KEY = "catalog:v1";

/**
 * Travelpayouts Airalo program identifiers from the official manual link template
 * (`tp.media/r?marker=…&trs=…&p=8310&u=LINK&campaign_id=541`).
 * The campaign id is stored on the offer token for analytics only; neither value is sent in
 * the Partner Links request, and no manual-template fallback is built from them.
 */
export const AIRALO_TRAVELPAYOUTS_CAMPAIGN_ID = "541";
export const AIRALO_TRAVELPAYOUTS_PRODUCT_ID = "8310";
