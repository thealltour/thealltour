import type { AffiliateCanonicalDestination } from "@/lib/affiliate/planner/destinationCanonical";
import type { KlookCityWidgetDescriptor } from "@/lib/affiliate/planner/discovery/types";
import { resolveKlookCityId } from "@/lib/affiliate/planner/providers/klook/klookCityIds";

/**
 * "Tours & Sightseeing" category id, verified in the Travelpayouts Klook widget generator.
 * Widget locale/currency/amount live with the embed builder (`discovery/tpWidgetSrc.ts`).
 */
export const KLOOK_TOURS_SIGHTSEEING_CATEGORY_ID = "2";

/**
 * Destination-level "more activities" widget (not an exact mustDo match).
 * Requires the Klook provider toggle and a verified city id; otherwise null.
 */
export function buildKlookCityWidgetDescriptor(params: {
  destination: AffiliateCanonicalDestination;
  enabled: boolean;
}): KlookCityWidgetDescriptor | null {
  if (!params.enabled) return null;
  const cityId = resolveKlookCityId(params.destination);
  if (!cityId) return null;
  return {
    providerId: "klook",
    kind: "city_widget",
    cityId,
    cityLabel: params.destination.displayText || params.destination.cityEnglish || "",
    categoryId: KLOOK_TOURS_SIGHTSEEING_CATEGORY_ID,
  };
}
