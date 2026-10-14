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

/** Per-day cap for item-level activity CTAs (avoid flooding every attraction). */
export const DAY_ACTIVITY_ITEM_MAX = 2;
/** Per-trip cap for item-level activity CTAs (bounds provider calls per Result). */
export const TRIP_ACTIVITY_ITEM_MAX = 6;

type ActivityCandidateDay = {
  day: number;
  items: Array<{ order: number; type: string; name: string; bookingRecommended: boolean }>;
};

export type ActivityItemTarget = {
  dayNumber: number;
  itemOrder: number;
  itemType: string;
  placeName: string;
};

/**
 * Items that get an item-level activity offer: activity/attraction items the plan marks
 * bookingRecommended, in day/order sequence, capped per day and per trip.
 */
export function selectActivityItemTargets(
  days: ActivityCandidateDay[],
  limits: { perDay?: number; perTrip?: number } = {},
): ActivityItemTarget[] {
  const perDay = limits.perDay ?? DAY_ACTIVITY_ITEM_MAX;
  const perTrip = limits.perTrip ?? TRIP_ACTIVITY_ITEM_MAX;
  const targets: ActivityItemTarget[] = [];
  for (const day of days) {
    let dayCount = 0;
    const items = [...day.items].sort((a, b) => a.order - b.order);
    for (const item of items) {
      if (targets.length >= perTrip) return targets;
      if (dayCount >= perDay) break;
      if (!item.bookingRecommended) continue;
      if (itemTypeToAffiliateCategory(item.type) !== "activity") continue;
      targets.push({
        dayNumber: day.day,
        itemOrder: item.order,
        itemType: item.type,
        placeName: item.name,
      });
      dayCount += 1;
    }
  }
  return targets;
}
