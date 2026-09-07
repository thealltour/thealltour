import {
  airaloProductTypeMatchesCountryCode,
  isAiraloRegionalOrGlobalProduct,
} from "@/lib/affiliate/planner/providers/airalo/airaloCountry";
import type { AiraloOfferRecord } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

/** Real New Feed uses `in stock` (space). Also accept underscore form defensively. */
function isInStock(availability: string | null): boolean {
  if (!availability) return false;
  const v = availability.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return v === "in stock";
}

function effectivePrice(record: AiraloOfferRecord): number | null {
  if (record.salePrice != null && Number.isFinite(record.salePrice)) return record.salePrice;
  if (record.price != null && Number.isFinite(record.price)) return record.price;
  return null;
}

/**
 * Deterministic Airalo product selection for a destination ISO country.
 * Ranking: local (non-regional/non-bundle) → lower effective price → stable id.
 * Excludes anything whose g:availability is not "in stock".
 */
export function selectAiraloOffer(params: {
  records: AiraloOfferRecord[];
  countryCode: string;
}): AiraloOfferRecord | null {
  const country = params.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;

  const candidates = params.records.filter((r) => {
    if (!r.sourceUrl || !r.id || !r.title) return false;
    if (!isInStock(r.availability)) return false;
    const matches =
      airaloProductTypeMatchesCountryCode(r.productType, country) ||
      (r.countryCode ?? "").toUpperCase() === country;
    if (!matches) return false;
    try {
      const u = new URL(r.sourceUrl);
      if (u.protocol !== "https:") return false;
    } catch {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const regionalA = isAiraloRegionalOrGlobalProduct({
      productType: a.productType,
      isBundle: a.isBundle,
    })
      ? 1
      : 0;
    const regionalB = isAiraloRegionalOrGlobalProduct({
      productType: b.productType,
      isBundle: b.isBundle,
    })
      ? 1
      : 0;
    if (regionalA !== regionalB) return regionalA - regionalB;

    const priceA = effectivePrice(a);
    const priceB = effectivePrice(b);
    if (priceA != null && priceB != null && priceA !== priceB) return priceA - priceB;
    if (priceA != null && priceB == null) return -1;
    if (priceA == null && priceB != null) return 1;

    return a.id.localeCompare(b.id);
  });

  return candidates[0] ?? null;
}
