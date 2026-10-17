import type { LocalrentDestination } from "@/lib/affiliate/planner/providers/localrent/localrentDestinations";

export const LOCALRENT_DEEP_LINK_ORIGIN = "https://www.localrent.com";
const LOCALRENT_LOCALE_PATH = "ko";
const LOCALRENT_CURRENCY = "KRW";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar-valid YYYY-MM-DD → UTC ms; anything else (incl. 2026-02-31) → null. */
function parseCalendarDate(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = YMD.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(m) - 1 ||
    check.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return ms;
}

/**
 * Korean/KRW Localrent search deep link with the Planner trip dates (pickup = start, dropoff = end).
 * Invalid dates or end not after start → null; never substitutes dates.
 * City ids are sent alongside slugs: with slugs alone Localrent may switch to another city.
 */
export function buildLocalrentDeepLink(params: {
  destination: LocalrentDestination;
  pickupDate: string | null | undefined;
  dropoffDate: string | null | undefined;
}): string | null {
  const { destination, pickupDate, dropoffDate } = params;
  const pickup = parseCalendarDate(pickupDate);
  const dropoff = parseCalendarDate(dropoffDate);
  if (pickup == null || dropoff == null || dropoff <= pickup) return null;
  if (!Number.isInteger(destination.cityId) || destination.cityId <= 0) return null;
  if (!/^[a-z0-9_]+$/.test(destination.countrySlug) || !/^[a-z0-9_]+$/.test(destination.citySlug)) {
    return null;
  }

  const url = new URL(`/${LOCALRENT_LOCALE_PATH}/${destination.countrySlug}/`, LOCALRENT_DEEP_LINK_ORIGIN);
  const cityId = String(destination.cityId);
  url.search = new URLSearchParams([
    ["pickup_date", pickupDate!],
    ["dropoff_date", dropoffDate!],
    ["pc", destination.citySlug],
    ["dc", destination.citySlug],
    ["pickup_city_id", cityId],
    ["dropoff_city_id", cityId],
    ["currency", LOCALRENT_CURRENCY],
  ]).toString();
  return url.toString();
}
