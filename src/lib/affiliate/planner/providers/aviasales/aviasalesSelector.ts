import {
  AVIASALES_ALLOWED_HOSTS,
  AVIASALES_DEFAULT_CURRENCY,
  AVIASALES_DEFAULT_LOCALE,
  AVIASALES_DEFAULT_MARKET,
  AVIASALES_SEARCH_ORIGIN,
  type AviasalesPriceOffer,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

export type AviasalesSelection = {
  offer: AviasalesPriceOffer;
  sourceUrl: string;
};

/**
 * Deterministic pick: lowest price → fewer transfers → lexical link.
 * Server-side only — price/airline never reach AffiliateOffer client DTO.
 */
export function selectAviasalesPriceOffer(params: {
  offers: AviasalesPriceOffer[];
}): AviasalesSelection | null {
  const candidates = params.offers.filter((o) => canBuildSearchUrl(o.link));
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    const tA = a.transfers ?? 99;
    const tB = b.transfers ?? 99;
    if (tA !== tB) return tA - tB;
    return a.link.localeCompare(b.link);
  });

  const best = sorted[0];
  if (!best) return null;
  const sourceUrl = buildAviasalesSearchUrl(best.link);
  if (!sourceUrl) return null;
  return { offer: best, sourceUrl };
}

/**
 * Travelpayouts docs: prepend https://www.aviasales.com/ to relative `link`.
 * Apply KR presentation (locale/currency/market) before Partner Links.
 */
export function buildAviasalesSearchUrl(link: string): string | null {
  if (!canBuildSearchUrl(link)) return null;
  try {
    const url = new URL(link, AVIASALES_SEARCH_ORIGIN);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed = AVIASALES_ALLOWED_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h.replace(/^www\./, "")}`),
    );
    if (!allowed) return null;
    if (!url.pathname.startsWith("/search")) return null;
    applyAviasalesKrPresentation(url);
    return url.toString();
  } catch {
    return null;
  }
}

/** Force Korean market presentation on brand search URLs. */
export function applyAviasalesKrPresentation(url: URL): void {
  url.searchParams.set("locale", AVIASALES_DEFAULT_LOCALE);
  url.searchParams.set("currency", AVIASALES_DEFAULT_CURRENCY);
  url.searchParams.set("market", AVIASALES_DEFAULT_MARKET);
  // Data API sometimes embeds expected_price_currency=usd on the relative link.
  if (url.searchParams.has("expected_price_currency")) {
    url.searchParams.set("expected_price_currency", AVIASALES_DEFAULT_CURRENCY);
  }
}

/** Affiliate search code encodes each passenger type as a single digit. */
export const AVIASALES_MAX_PASSENGERS_PER_TYPE = 9;

export type AviasalesCanonicalSearchInput = {
  originIata: string;
  destinationIata: string;
  /** YYYY-MM-DD */
  departureDate: string;
  /** YYYY-MM-DD; null/absent → one-way. */
  returnDate?: string | null;
  adults: number;
  children: number;
};

export type AviasalesCanonicalSearchFailure =
  | "invalid_iata"
  | "invalid_dates"
  | "unsupported_travelers"
  | "unsafe_url";

export type AviasalesCanonicalSearchResult =
  | { ok: true; url: string }
  | { ok: false; reason: AviasalesCanonicalSearchFailure };

/**
 * Economy passenger suffix: `[adults][children]` (children omitted when 0).
 * Out-of-range counts → null (never clamped). Infants are never encoded (not in Planner data).
 */
export function aviasalesPassengerSuffix(travelers: {
  adults: number;
  children: number;
}): string | null {
  const { adults, children } = travelers;
  if (!Number.isInteger(adults) || adults < 1 || adults > AVIASALES_MAX_PASSENGERS_PER_TYPE) {
    return null;
  }
  if (
    !Number.isInteger(children) ||
    children < 0 ||
    children > AVIASALES_MAX_PASSENGERS_PER_TYPE
  ) {
    return null;
  }
  return children > 0 ? `${adults}${children}` : `${adults}`;
}

/** YYYY-MM-DD → DDMM via string parts only (no Date timezone shift). */
export function toAviasalesDayMonth(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return `${day}${month}`;
}

/**
 * Planner-condition Aviasales search URL (economy):
 * `/search/{ORIGIN}{DDMM}{DEST}[{DDMM}]{adults}[{children}]` + KR presentation.
 * Built from Planner input only — never from a Data API fare link or its query.
 */
export function buildAviasalesCanonicalSearchUrl(
  input: AviasalesCanonicalSearchInput,
): AviasalesCanonicalSearchResult {
  const origin = input.originIata.trim().toUpperCase();
  const destination = input.destinationIata.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
    return { ok: false, reason: "invalid_iata" };
  }

  const departure = toAviasalesDayMonth(input.departureDate);
  if (!departure) return { ok: false, reason: "invalid_dates" };
  const returnDate = input.returnDate?.trim() || null;
  let returnSegment = "";
  if (returnDate) {
    const ret = toAviasalesDayMonth(returnDate);
    if (!ret || returnDate < input.departureDate.trim()) {
      return { ok: false, reason: "invalid_dates" };
    }
    returnSegment = ret;
  }

  const passengers = aviasalesPassengerSuffix(input);
  if (!passengers) return { ok: false, reason: "unsupported_travelers" };

  const url = buildAviasalesSearchUrl(
    `/search/${origin}${departure}${destination}${returnSegment}${passengers}`,
  );
  return url ? { ok: true, url } : { ok: false, reason: "unsafe_url" };
}

export function canBuildSearchUrl(link: string): boolean {
  const trimmed = link.trim();
  if (!trimmed.startsWith("/search")) return false;
  // Reject protocol-relative or open redirects in the path payload.
  if (trimmed.includes("://") || trimmed.startsWith("//")) return false;
  return true;
}

export function aviasalesSourceHost(sourceUrl: string): string | null {
  return safeHostnameFromUrl(sourceUrl);
}
