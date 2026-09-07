import type { AffiliateDestinationOverride } from "@/lib/affiliate/planner/providerConfig";
import type {
  AffiliateProviderDefinition,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";

export type EligibilityReject = { providerId: string; reason: string };

export function checkStaticEligibility(params: {
  definition: AffiliateProviderDefinition;
  context: AffiliateRoutingContext;
  overrides?: AffiliateDestinationOverride[];
}): { ok: true } | { ok: false; reason: string } {
  const { definition, context, overrides = [] } = params;

  if (!definition.enabled) {
    return { ok: false, reason: "disabled" };
  }
  if (!definition.categories.includes(context.category)) {
    return { ok: false, reason: "category_mismatch" };
  }
  if (!definition.supportedPlacements.includes(context.placement)) {
    return { ok: false, reason: "placement_mismatch" };
  }
  if (
    definition.supportedDateModes &&
    definition.supportedDateModes.length > 0 &&
    !definition.supportedDateModes.includes(context.dates.mode)
  ) {
    return { ok: false, reason: "date_mode_unsupported" };
  }

  const country = context.destination.countryCode?.toUpperCase() ?? null;
  if (country && definition.excludedCountries?.includes(country)) {
    return { ok: false, reason: "country_excluded" };
  }
  if (
    country &&
    definition.supportedCountries &&
    definition.supportedCountries.length > 0 &&
    !definition.supportedCountries.includes(country)
  ) {
    return { ok: false, reason: "country_unsupported" };
  }

  // Destination override: if any override exists for this category+destination,
  // only listed providers pass (structure ready; empty list = no filter).
  const destKey = country ?? normalizeDestinationKey(context.destination.text);
  const relevant = overrides.filter(
    (o) => o.category === context.category && o.destinationKey === destKey,
  );
  if (relevant.length > 0 && !relevant.some((o) => o.providerId === definition.id)) {
    return { ok: false, reason: "destination_override" };
  }

  return { ok: true };
}

export function normalizeDestinationKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Day item types that may map to activity affiliate category. */
export function itemTypeToAffiliateCategory(
  itemType: string | null | undefined,
): "activity" | null {
  if (itemType === "activity" || itemType === "attraction") return "activity";
  return null;
}
