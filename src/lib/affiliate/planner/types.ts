/**
 * Planner Affiliate Router v0 — canonical types.
 * No provider-specific UI coupling; no ML/BGE ranking.
 */

export const AFFILIATE_CATEGORIES = [
  "flight",
  "hotel",
  "activity",
  "esim",
  "transfer",
  "rental_car",
  "insurance",
  "travel_goods",
] as const;

export type AffiliateCategory = (typeof AFFILIATE_CATEGORIES)[number];

export const AFFILIATE_PLACEMENTS = [
  "planner_summary",
  "day_item",
  "preparation",
  "transport",
  "saved_plan",
] as const;

export type AffiliatePlacement = (typeof AFFILIATE_PLACEMENTS)[number];

export const AFFILIATE_PROVIDER_IDS = [
  "travelpayouts_white_label",
  "aviasales",
  "klook",
  "kkday",
  "tiqets",
  "yesim",
  "airalo",
  "wegotrip",
  "kiwitaxi",
  "toss_shopping",
  "coupang",
] as const;

export type AffiliateProviderId = (typeof AFFILIATE_PROVIDER_IDS)[number];

export type AffiliateNetwork = "travelpayouts";

/** Higher number = higher priority. Ties break by providerId lexical ascending. */
export type AffiliateProviderDefinition = {
  id: AffiliateProviderId;
  displayName: string;
  categories: AffiliateCategory[];
  enabled: boolean;
  supportedCountries?: string[];
  excludedCountries?: string[];
  supportedDateModes?: ("fixed" | "flexible")[];
  supportedPlacements: AffiliatePlacement[];
  /** Higher = preferred. */
  priority: number;
  /** Optional network tag for future adapters (PR-9B+). */
  network?: AffiliateNetwork;
  capabilities: {
    deepLink: boolean;
    search: boolean;
    api: boolean;
    widget: boolean;
  };
};

export type AffiliateDestination = {
  text: string;
  /** ISO 3166-1 alpha-2 when reliably known; never inferred from display names. */
  countryCode: string | null;
  /** Provider-neutral city codes when resolved (future). */
  cityCode?: string | null;
  iataCityCode?: string | null;
  iataAirportCodes?: string[];
};

export type AffiliateRoutingDates = {
  mode: "fixed" | "flexible";
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
};

/**
 * Optional flight departure foundation (PR-9D).
 * Never invent Seoul/ICN/locale/IP defaults — pass null until Planner supplies origin.
 */
export type AffiliateFlightOrigin = {
  text: string;
  /** Validated 3-letter IATA; required for Aviasales price calls. */
  iata: string;
};

export type AffiliateRoutingContext = {
  plannerSessionId: string;
  destination: AffiliateDestination;
  dates: AffiliateRoutingDates;
  travelers: { adults: number; children: number };
  companionType: string;
  interests: string[];
  pace: string;
  placement: AffiliatePlacement;
  category: AffiliateCategory;
  dayNumber?: number | null;
  itemOrder?: number | null;
  itemType?: string | null;
  placeId?: string | null;
  placeName?: string | null;
  sourceProductId?: string | null;
  /**
   * Explicit departure origin for flight providers.
   * Resolved once from draft.origin text in buildAffiliateOffersForSession.
   */
  flightOrigin?: AffiliateFlightOrigin | null;
};

/** Client-safe offer — never includes target URL or provider secrets. */
export type AffiliateOffer = {
  offerId: string;
  providerId: string;
  category: AffiliateCategory;
  placement: AffiliatePlacement;
  title: string;
  description: string | null;
  ctaLabel: string;
  destinationLabel: string | null;
  trackingToken: string;
  metadata?: {
    dayNumber?: number;
    itemOrder?: number;
  };
};

/** Server-only build result before token persistence. */
export type AffiliateOfferBuild = {
  providerId: AffiliateProviderId;
  category: AffiliateCategory;
  placement: AffiliatePlacement;
  title: string;
  description: string | null;
  ctaLabel: string;
  destinationLabel: string | null;
  /** Absolute https URL resolved by adapter; never sent to client. */
  targetUrl: string;
  dayNumber?: number | null;
  itemOrder?: number | null;
  /** Opaque network SubID (e.g. Travelpayouts) — not the internal tracking token. */
  providerSubId?: string | null;
  affiliateNetwork?: AffiliateNetwork | null;
  affiliateCampaignId?: string | null;
  /** Hostname only of pre-affiliate brand URL. */
  sourceUrlHost?: string | null;
};

export type AffiliateRoutingDecision = {
  selectedProviderId: string | null;
  category: AffiliateCategory;
  placement: AffiliatePlacement;
  eligibleProviderIds: string[];
  rejectedReasons: Array<{ providerId: string; reason: string }>;
};

export type PlannerAffiliateOffersDto = {
  summary: AffiliateOffer[];
  preparation: AffiliateOffer[];
  days: Record<string, AffiliateOffer[]>;
  disclosure: string | null;
};
