import { resolveAffiliateCanonicalDestination } from "@/lib/affiliate/planner/destinationCanonical";
import {
  LOCALRENT_AMBIGUOUS_ALIASES,
  LOCALRENT_DESTINATIONS,
  LOCALRENT_EXCLUDED_COUNTRY_CODES,
  type LocalrentDestination,
} from "@/lib/affiliate/planner/providers/localrent/localrentDestinations";
import type { AffiliateDestination } from "@/lib/affiliate/planner/types";

export type LocalrentDestinationSkipReason =
  | "country_unknown"
  | "country_excluded"
  | "ambiguous_destination"
  | "unsupported_destination";

export type LocalrentDestinationResolution =
  | { ok: true; destination: LocalrentDestination }
  | { ok: false; reason: LocalrentDestinationSkipReason };

export function normalizeLocalrentAlias(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/**
 * Planner destination → verified Localrent city. Exact normalized alias match within the
 * destination's country only; no fuzzy matching, no network, no country-level fallback.
 */
export function resolveLocalrentDestination(
  destination: Pick<AffiliateDestination, "text" | "countryCode">,
  catalog: {
    destinations?: readonly LocalrentDestination[];
    ambiguous?: typeof LOCALRENT_AMBIGUOUS_ALIASES;
  } = {},
): LocalrentDestinationResolution {
  const countryCode = destination.countryCode?.trim().toUpperCase() || null;
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return { ok: false, reason: "country_unknown" };
  if (LOCALRENT_EXCLUDED_COUNTRY_CODES.includes(countryCode)) {
    return { ok: false, reason: "country_excluded" };
  }

  const canonical = resolveAffiliateCanonicalDestination(destination);
  const keys = new Set(
    [destination.text, canonical.cityEnglish]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map(normalizeLocalrentAlias),
  );
  if (keys.size === 0) return { ok: false, reason: "unsupported_destination" };

  const ambiguous = catalog.ambiguous ?? LOCALRENT_AMBIGUOUS_ALIASES;
  if (
    ambiguous.some(
      (entry) =>
        entry.countryCode === countryCode &&
        entry.aliases.some((alias) => keys.has(normalizeLocalrentAlias(alias))),
    )
  ) {
    return { ok: false, reason: "ambiguous_destination" };
  }

  const destinations = catalog.destinations ?? LOCALRENT_DESTINATIONS;
  const matches = destinations.filter(
    (entry) =>
      entry.countryCode === countryCode &&
      entry.aliases.some((alias) => keys.has(normalizeLocalrentAlias(alias))),
  );
  if (matches.length > 1) return { ok: false, reason: "ambiguous_destination" };
  const [match] = matches;
  return match ? { ok: true, destination: match } : { ok: false, reason: "unsupported_destination" };
}
