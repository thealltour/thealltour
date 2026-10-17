import {
  airaloProductTypeMatchesCountryCode,
  isAiraloRegionalOrGlobalProduct,
  parseAiraloProductTypePlanDetails,
  type AiraloPlanDetails,
} from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import { normalizeAiraloAvailability } from "@/lib/affiliate/planner/providers/airalo/airaloFeedParser";
import type { AiraloOfferRecord } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

/** Real New Feed uses `in stock`; cached pre-PR-9AO rows hold raw strings, so normalize on read. */
function isInStock(availability: string | null): boolean {
  return normalizeAiraloAvailability(availability) === "in stock";
}

function effectivePrice(record: AiraloOfferRecord): number | null {
  if (record.salePrice != null && Number.isFinite(record.salePrice)) return record.salePrice;
  if (record.price != null && Number.isFinite(record.price)) return record.price;
  return null;
}

/** Plan details from the record, re-derived from product_type for catalogs cached before PR-9AO. */
export function resolveAiraloPlanDetails(record: AiraloOfferRecord): AiraloPlanDetails {
  const parsed = parseAiraloProductTypePlanDetails(record.productType);
  return {
    dataLabel: record.dataLabel !== undefined ? record.dataLabel : parsed.dataLabel,
    dataMb: parsed.dataMb,
    validityDays: record.validityDays !== undefined ? record.validityDays : parsed.validityDays,
  };
}

/** Trip length in days when usable for plan fit; anything else → null (no duration filter). */
export function normalizeTripDurationDays(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) return null;
  return raw;
}

/** Validity covers the whole trip. Unknown validity or trip length → null (cannot tell). */
export function airaloPlanCoversTrip(
  validityDays: number | null,
  tripDurationDays: number | null,
): boolean | null {
  if (validityDays == null || tripDurationDays == null) return null;
  return validityDays >= tripDurationDays;
}

type Candidate = {
  record: AiraloOfferRecord;
  regional: 0 | 1;
  /** 0 = covers trip, 1 = validity unknown, 2 = shorter than trip. Always 0 without trip length. */
  fitRank: 0 | 1 | 2;
  validityDays: number | null;
  dataMb: number | null;
  price: number | null;
};

function fitRankFor(validityDays: number | null, tripDurationDays: number | null): 0 | 1 | 2 {
  if (tripDurationDays == null) return 0;
  const covers = airaloPlanCoversTrip(validityDays, tripDurationDays);
  if (covers === true) return 0;
  if (covers === null) return 1;
  return 2;
}

function compareCandidates(a: Candidate, b: Candidate, tripDurationDays: number | null): number {
  if (a.regional !== b.regional) return a.regional - b.regional;

  if (tripDurationDays != null) {
    if (a.fitRank !== b.fitRank) return a.fitRank - b.fitRank;
    if (a.fitRank === 0 && a.validityDays !== b.validityDays) {
      // Least excessive validity that still covers the trip.
      return (a.validityDays ?? Infinity) - (b.validityDays ?? Infinity);
    }
    if (a.fitRank === 2 && a.validityDays !== b.validityDays) {
      // None cover the trip: closest to the trip length.
      return (b.validityDays ?? 0) - (a.validityDays ?? 0);
    }
  }

  if (a.price != null && b.price != null && a.price !== b.price) return a.price - b.price;
  if (a.price != null && b.price == null) return -1;
  if (a.price == null && b.price != null) return 1;

  if (a.dataMb != null && b.dataMb != null && a.dataMb !== b.dataMb) return b.dataMb - a.dataMb;
  if (a.dataMb != null && b.dataMb == null) return -1;
  if (a.dataMb == null && b.dataMb != null) return 1;

  return a.record.id.localeCompare(b.record.id);
}

/**
 * Deterministic Airalo product selection for a destination ISO country (one product).
 * Ranking: local before regional/bundle → (trip length known) validity covering the trip,
 * least excessive first; unknown validity next; too-short plans last → lower effective price
 * → larger data → stable id. Without a trip length the PR-9C order (local → price → id) holds.
 * Excludes anything whose g:availability is not "in stock".
 */
export function selectAiraloOffer(params: {
  records: AiraloOfferRecord[];
  countryCode: string;
  tripDurationDays?: number | null;
}): AiraloOfferRecord | null {
  const country = params.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const tripDurationDays = normalizeTripDurationDays(params.tripDurationDays);

  const candidates: Candidate[] = [];
  for (const r of params.records) {
    if (!r.sourceUrl || !r.id || !r.title) continue;
    if (!isInStock(r.availability)) continue;
    const matches =
      airaloProductTypeMatchesCountryCode(r.productType, country) ||
      (r.countryCode ?? "").toUpperCase() === country;
    if (!matches) continue;
    try {
      const u = new URL(r.sourceUrl);
      if (u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    const plan = resolveAiraloPlanDetails(r);
    candidates.push({
      record: r,
      regional: isAiraloRegionalOrGlobalProduct({
        productType: r.productType,
        isBundle: r.isBundle,
      })
        ? 1
        : 0,
      fitRank: fitRankFor(plan.validityDays, tripDurationDays),
      validityDays: plan.validityDays,
      dataMb: plan.dataMb,
      price: effectivePrice(r),
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => compareCandidates(a, b, tripDurationDays));
  return candidates[0]?.record ?? null;
}
