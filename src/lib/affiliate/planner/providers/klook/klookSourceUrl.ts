import type { NamedActivityId } from "@/lib/affiliate/planner/namedActivityCatalog";
import { cleanNamedActivitySourceUrl } from "@/lib/affiliate/planner/namedActivityOffer";

export const KLOOK_ALLOWED_HOSTS = ["klook.com", "www.klook.com"] as const;

/**
 * Official Klook product pages (clean brand URLs; Travelpayouts Partner Links adds attribution).
 * Never append another network's aid/aff_adid/aff_ext/af_wid params.
 */
export const KLOOK_ACTIVITY_SOURCE_URLS: Partial<Record<NamedActivityId, string>> = {
  universal_studios_japan:
    "https://www.klook.com/en-US/activity/46604-universal-studios-japan-e-ticket-osaka-qr-code-direct-entry/",
};

export function klookSourceUrlFor(id: NamedActivityId): string | null {
  return cleanNamedActivitySourceUrl(KLOOK_ACTIVITY_SOURCE_URLS[id], KLOOK_ALLOWED_HOSTS);
}
