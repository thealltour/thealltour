import {
  AVIASALES_ALLOWED_HOSTS,
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
 * Result is a brand search URL suitable for Partner Links (not a GraphQL ticket).
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
    return url.toString();
  } catch {
    return null;
  }
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
