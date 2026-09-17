import "server-only";

import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type {
  PlannerEnrichmentDto,
  PlannerPlaceEnrichmentItem,
  PlannerResolvedPlace,
} from "@/lib/planner/enrichmentTypes";
import { computePlannerPlanFingerprint } from "@/lib/planner/planFingerprint";
import {
  listPlaceEnrichmentsForFingerprint,
  replacePlaceEnrichmentsForFingerprint,
} from "@/lib/planner/placeEnrichmentRepository";
import {
  buildPlacesSearchQuery,
  classifyPlacesCandidates,
  isConcretePlannerPlaceCandidate,
  normalizePlaceDedupeKey,
  shouldResolvePlannerItemType,
} from "@/lib/planner/placesQuery";
import {
  isPlacesProviderConfigured,
  mapWithConcurrency,
  PlacesProviderError,
  searchPlacesText,
} from "@/lib/planner/placesClient";
import { fetchPlannerWeatherSummary } from "@/lib/planner/plannerWeather";
import { resolvePlannerRoutes } from "@/lib/planner/resolvePlannerRoutes";

export const PLANNER_PLACE_RESOLVE_MAX = 40;
export const PLANNER_PLACE_CONCURRENCY = 4;

type WorkItem = {
  dayNumber: number;
  itemOrder: number;
  itemType: PlannerPlan["days"][number]["items"][number]["type"];
  name: string;
  area: string | null;
  destination: string;
  country: string | null;
  dedupeKey: string;
};

type PlaceLookupKind = "classified" | "provider_failure";

type PlaceLookupResult = {
  key: string;
  place: PlannerResolvedPlace;
  kind: PlaceLookupKind;
  category?: PlacesProviderError["category"];
  httpStatus?: number | null;
  dayNumber: number;
  itemOrder: number;
  itemType: WorkItem["itemType"];
};

function unresolvedPlace(originalName: string): PlannerResolvedPlace {
  return {
    status: "unresolved",
    originalName,
    placeId: null,
    displayName: null,
    formattedAddress: null,
    location: null,
    types: [],
    googleMapsUri: null,
  };
}

function fromClassification(
  originalName: string,
  classified: ReturnType<typeof classifyPlacesCandidates>,
): PlannerResolvedPlace {
  if (classified.status === "unresolved" || !classified.best) {
    return unresolvedPlace(originalName);
  }
  const best = classified.best;
  return {
    status: classified.status,
    originalName,
    placeId: classified.status === "resolved" ? best.placeId : null,
    displayName: best.displayName,
    formattedAddress: best.formattedAddress,
    location: { lat: best.lat, lng: best.lng },
    types: best.types,
    googleMapsUri: best.googleMapsUri,
  };
}

function collectEligibleWork(plan: PlannerPlan): {
  eligible: WorkItem[];
  skippedGeneric: number;
} {
  const destination = plan.destination.name;
  const country = plan.destination.country?.trim() || null;
  const eligible: WorkItem[] = [];
  let skippedGeneric = 0;

  for (const day of plan.days) {
    for (const item of day.items) {
      if (!shouldResolvePlannerItemType(item.type)) continue;
      if (!isConcretePlannerPlaceCandidate({ type: item.type, name: item.name })) {
        skippedGeneric += 1;
        continue;
      }
      eligible.push({
        dayNumber: day.day,
        itemOrder: item.order,
        itemType: item.type,
        name: item.name,
        area: item.area,
        destination,
        country,
        dedupeKey: normalizePlaceDedupeKey({
          destination,
          area: item.area,
          name: item.name,
        }),
      });
    }
  }

  return { eligible, skippedGeneric };
}

function cacheCoversEligible(
  cached: PlannerPlaceEnrichmentItem[],
  capped: WorkItem[],
): boolean {
  if (capped.length === 0) return cached.length === 0;
  if (cached.length < capped.length) return false;
  const keys = new Set(cached.map((c) => `${c.dayNumber}:${c.itemOrder}`));
  return capped.every((w) => keys.has(`${w.dayNumber}:${w.itemOrder}`));
}

export async function enrichPlannerSession(params: {
  sessionId: string;
  plan: PlannerPlan;
}): Promise<PlannerEnrichmentDto> {
  const planFingerprint = computePlannerPlanFingerprint(params.plan);
  const { eligible, skippedGeneric } = collectEligibleWork(params.plan);
  const capped = eligible.slice(0, PLANNER_PLACE_RESOLVE_MAX);

  const existing = await listPlaceEnrichmentsForFingerprint({
    sessionId: params.sessionId,
    planFingerprint,
  });

  let places: PlannerPlaceEnrichmentItem[] = existing.items;
  let partialFailure = false;
  let placeRequestCount = 0;
  const placeEligibleCount = capped.length;
  const placeSkippedGenericCount = skippedGeneric;
  let placeProviderFailureCount = 0;

  const useCache = existing.fresh && cacheCoversEligible(existing.items, capped);

  if (!useCache) {
    const resolvedByKey = new Map<string, PlaceLookupResult>();
    const uniqueKeys = [...new Set(capped.map((w) => w.dedupeKey))];
    const uniqueWork = uniqueKeys.map((key) => capped.find((w) => w.dedupeKey === key)!);

    if (uniqueWork.length > 0 && !isPlacesProviderConfigured()) {
      console.info("[planner] places unavailable", {
        sessionId: params.sessionId,
        category: "missing_key",
      });
      partialFailure = true;
      placeProviderFailureCount = uniqueWork.length;
      for (const w of uniqueWork) {
        resolvedByKey.set(w.dedupeKey, {
          key: w.dedupeKey,
          place: unresolvedPlace(w.name),
          kind: "provider_failure",
          category: "missing_key",
          httpStatus: null,
          dayNumber: w.dayNumber,
          itemOrder: w.itemOrder,
          itemType: w.itemType,
        });
      }
    } else if (uniqueWork.length > 0) {
      placeRequestCount = uniqueWork.length;
      const uniqueResults = await mapWithConcurrency(
        uniqueWork,
        PLANNER_PLACE_CONCURRENCY,
        async (w) => {
          const textQuery = buildPlacesSearchQuery({
            name: w.name,
            area: w.area,
            destination: w.destination,
            country: w.country,
          });
          try {
            const candidates = await searchPlacesText({ textQuery });
            const classified = classifyPlacesCandidates(candidates, {
              name: w.name,
              area: w.area,
              destination: w.destination,
            });
            return {
              key: w.dedupeKey,
              place: fromClassification(w.name, classified),
              kind: "classified" as const,
              dayNumber: w.dayNumber,
              itemOrder: w.itemOrder,
              itemType: w.itemType,
            };
          } catch (error) {
            partialFailure = true;
            placeProviderFailureCount += 1;
            const category =
              error instanceof PlacesProviderError ? error.category : "unknown";
            const httpStatus =
              error instanceof PlacesProviderError ? error.httpStatus : null;
            console.info("[planner] places resolve failed", {
              sessionId: params.sessionId,
              category,
              httpStatus,
              itemType: w.itemType,
              dayNumber: w.dayNumber,
              itemOrder: w.itemOrder,
            });
            return {
              key: w.dedupeKey,
              place: unresolvedPlace(w.name),
              kind: "provider_failure" as const,
              category: error instanceof PlacesProviderError ? error.category : undefined,
              httpStatus,
              dayNumber: w.dayNumber,
              itemOrder: w.itemOrder,
              itemType: w.itemType,
            };
          }
        },
      );

      for (const r of uniqueResults) {
        resolvedByKey.set(r.key, r);
      }
    }

    places = capped.map((w) => ({
      dayNumber: w.dayNumber,
      itemOrder: w.itemOrder,
      place: resolvedByKey.get(w.dedupeKey)?.place ?? unresolvedPlace(w.name),
    }));

    // Persist only lookup_success (classified), including actual zero-result unresolved.
    // Never persist provider_failure (avoids 30d cache poisoning).
    const persistable = capped
      .map((w) => {
        const r = resolvedByKey.get(w.dedupeKey);
        if (!r || r.kind !== "classified") return null;
        return {
          dayNumber: w.dayNumber,
          itemOrder: w.itemOrder,
          place: r.place,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (persistable.length > 0) {
      try {
        await replacePlaceEnrichmentsForFingerprint({
          sessionId: params.sessionId,
          planFingerprint,
          items: persistable,
        });
      } catch {
        partialFailure = true;
      }
    }
  }

  const weather =
    params.plan.tripOverview.startDate == null || params.plan.tripOverview.endDate == null
      ? { availability: "date_not_set" as const, days: [] }
      : await fetchPlannerWeatherSummary({
          destination: params.plan.destination.name,
          startDate: params.plan.tripOverview.startDate,
          endDate: params.plan.tripOverview.endDate,
        });

  const routeResult = await resolvePlannerRoutes({
    sessionId: params.sessionId,
    plan: params.plan,
    planFingerprint,
    places,
  });
  if (routeResult.partialFailure) partialFailure = true;

  const resolvedPlaceCount = places.filter((p) => p.place.status === "resolved").length;
  const ambiguousPlaceCount = places.filter((p) => p.place.status === "ambiguous").length;
  const unresolvedPlaceCount = places.filter((p) => p.place.status === "unresolved").length;
  const resolvedRouteCount = routeResult.routes.filter((r) => r.status === "resolved").length;

  console.info("[planner] enrich", {
    sessionId: params.sessionId,
    placeEligibleCount,
    placeSkippedGenericCount,
    placeRequestCount,
    resolvedPlaceCount,
    ambiguousPlaceCount,
    unresolvedPlaceCount,
    placeProviderFailureCount,
    routesRequestCount: routeResult.requestCount,
    resolvedRouteCount,
    weatherAvailability: weather.availability,
    partialFailure,
  });

  let message: string | null = null;
  if (partialFailure) {
    message = "일부 장소 정보를 확인하지 못했습니다.";
  } else if (weather.availability === "date_not_set") {
    message = "여행 날짜를 정하면 최신 날씨를 확인할 수 있어요.";
  } else if (weather.availability === "too_early") {
    message = "여행일이 가까워지면 최신 날씨를 확인할 수 있어요.";
  }

  return {
    planFingerprint,
    places,
    routes: routeResult.routes,
    weather,
    partialFailure,
    message,
  };
}
