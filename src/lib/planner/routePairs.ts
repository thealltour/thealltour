import type { PlannerPlan, PlannerPlanItem } from "@/lib/planner/planSchemas";
import type {
  PlannerPlaceEnrichmentItem,
  PlannerRouteTravelMode,
} from "@/lib/planner/enrichmentTypes";

export type RoutePairCandidate = {
  day: number;
  date: string;
  fromOrder: number;
  toOrder: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** Canonical mode used for Routes lookup / storage. */
  mode: PlannerRouteTravelMode;
  /** Google Routes travelMode enum value, or null to skip provider call. */
  googleTravelMode: "WALK" | "DRIVE" | "TRANSIT" | null;
  departureTimeIso: string | null;
  dedupeKey: string;
};

export function mapAiTravelModeToRouteMode(
  mode: PlannerPlanItem["travelToNext"] extends infer T
    ? T extends { mode: infer M }
      ? M
      : null
    : null,
): PlannerRouteTravelMode {
  if (mode === "walk") return "walk";
  if (mode === "public_transit") return "public_transit";
  if (mode === "car" || mode === "taxi") return "drive";
  return "other";
}

export function toGoogleTravelMode(
  mode: PlannerRouteTravelMode,
): "WALK" | "DRIVE" | "TRANSIT" | null {
  if (mode === "walk") return "WALK";
  if (mode === "drive") return "DRIVE";
  if (mode === "public_transit") return "TRANSIT";
  return null;
}

/** Transit needs a real item time — do not invent departure when time is null. */
function buildDepartureIso(dateYmd: string, timeHHmm: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  if (!timeHHmm || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeHHmm)) return null;
  return `${dateYmd}T${timeHHmm}:00Z`;
}

/**
 * Build consecutive itinerary pairs.
 * Only when BOTH endpoints are resolved with coordinates.
 * Never skip across unresolved middle items.
 */
export function buildConsecutiveRoutePairs(params: {
  plan: PlannerPlan;
  places: PlannerPlaceEnrichmentItem[];
}): RoutePairCandidate[] {
  const placeMap = new Map<string, PlannerPlaceEnrichmentItem>();
  for (const p of params.places) {
    placeMap.set(`${p.dayNumber}:${p.itemOrder}`, p);
  }

  const pairs: RoutePairCandidate[] = [];

  for (const day of params.plan.days) {
    const items = [...day.items].sort((a, b) => a.order - b.order);
    for (let i = 0; i < items.length - 1; i += 1) {
      const fromItem = items[i]!;
      const toItem = items[i + 1]!;
      const fromPlace = placeMap.get(`${day.day}:${fromItem.order}`);
      const toPlace = placeMap.get(`${day.day}:${toItem.order}`);

      if (
        !fromPlace ||
        !toPlace ||
        fromPlace.place.status !== "resolved" ||
        toPlace.place.status !== "resolved" ||
        !fromPlace.place.location ||
        !toPlace.place.location
      ) {
        continue;
      }

      const mode = mapAiTravelModeToRouteMode(fromItem.travelToNext?.mode ?? null);
      let googleTravelMode = toGoogleTravelMode(mode);
      const departureTimeIso = buildDepartureIso(day.date, fromItem.time);

      // Transit without usable departure → skip provider (AI fallback)
      if (googleTravelMode === "TRANSIT" && !departureTimeIso) {
        googleTravelMode = null;
      }

      const dedupeKey = [
        fromPlace.place.location.lat.toFixed(5),
        fromPlace.place.location.lng.toFixed(5),
        toPlace.place.location.lat.toFixed(5),
        toPlace.place.location.lng.toFixed(5),
        mode,
        googleTravelMode ?? "skip",
      ].join("|");

      pairs.push({
        day: day.day,
        date: day.date,
        fromOrder: fromItem.order,
        toOrder: toItem.order,
        from: fromPlace.place.location,
        to: toPlace.place.location,
        mode,
        googleTravelMode,
        departureTimeIso,
        dedupeKey,
      });
    }
  }

  return pairs;
}

export function formatDistanceMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1).replace(/\.0$/, "")}km`;
}

export function routeLookupKey(day: number, fromOrder: number, toOrder: number): string {
  return `${day}:${fromOrder}:${toOrder}`;
}

/** Hard cap on route segments per plan enrichment. */
export const PLANNER_ROUTE_RESOLVE_MAX = 30;
/** Bounded concurrency for Routes API calls. */
export const PLANNER_ROUTE_CONCURRENCY = 4;
