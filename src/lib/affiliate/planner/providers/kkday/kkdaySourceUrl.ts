import type { NamedActivityId } from "@/lib/affiliate/planner/namedActivityCatalog";
import { cleanNamedActivitySourceUrl } from "@/lib/affiliate/planner/namedActivityOffer";

export const KKDAY_ALLOWED_HOSTS = ["kkday.com", "www.kkday.com"] as const;

/**
 * Official KKday product pages (clean brand URLs; Travelpayouts Partner Links adds attribution).
 * Never append another network's cid/UD1/UD2/r params.
 */
export const KKDAY_ACTIVITY_SOURCE_URLS: Partial<Record<NamedActivityId, string>> = {
  universal_studios_japan: "https://www.kkday.com/en/product/2247-universal-studios-japan-ticket-osaka",
};

export function kkdaySourceUrlFor(id: NamedActivityId): string | null {
  return cleanNamedActivitySourceUrl(KKDAY_ACTIVITY_SOURCE_URLS[id], KKDAY_ALLOWED_HOSTS);
}
