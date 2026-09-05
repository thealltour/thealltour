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
  normalizePlaceDedupeKey,
  shouldResolvePlannerItemType,
} from "@/lib/planner/placesQuery";
import { mapWithConcurrency, PlacesProviderError, searchPlacesText } from "@/lib/planner/placesClient";
import { fetchPlannerWeatherSummary } from "@/lib/planner/plannerWeather";
import { resolvePlannerRoutes } from "@/lib/planner/resolvePlannerRoutes";

export const PLANNER_PLACE_RESOLVE_MAX = 40;
export const PLANNER_PLACE_CONCURRENCY = 4;

type WorkItem = {
  dayNumber: number;
  itemOrder: number;
  name: string;
  area: string | null;
  destination: string;
  dedupeKey: string;
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

export async function enrichPlannerSession(params: {
  sessionId: string;
  plan: PlannerPlan;
}): Promise<PlannerEnrichmentDto> {
  const planFingerprint = computePlannerPlanFingerprint(params.plan);
  const destination = params.plan.destination.name;

  const existing = await listPlaceEnrichmentsForFingerprint({
    sessionId: params.sessionId,
    planFingerprint,
  });

  let places: PlannerPlaceEnrichmentItem[] = existing.items;
  let partialFailure = false;
  let placeRequestCount = 0;

  if (!existing.fresh || existing.items.length === 0) {
    const work: WorkItem[] = [];
    for (const day of params.plan.days) {
      for (const item of day.items) {
        if (!shouldResolvePlannerItemType(item.type)) continue;
        work.push({
          dayNumber: day.day,
          itemOrder: item.order,
          name: item.name,
          area: item.area,
          destination,
          dedupeKey: normalizePlaceDedupeKey({
            destination,
            area: item.area,
            name: item.name,
          }),
        });
      }
    }

    const capped = work.slice(0, PLANNER_PLACE_RESOLVE_MAX);
    const uniqueKeys = [...new Set(capped.map((w) => w.dedupeKey))];
    const resolvedByKey = new Map<string, PlannerResolvedPlace>();
    const uniqueWork = uniqueKeys.map((key) => capped.find((w) => w.dedupeKey === key)!);

    const uniqueResults = await mapWithConcurrency(
      uniqueWork,
      PLANNER_PLACE_CONCURRENCY,
      async (w) => {
        placeRequestCount += 1;
        const textQuery = buildPlacesSearchQuery({
          name: w.name,
          area: w.area,
          destination: w.destination,
        });
        try {
          const candidates = await searchPlacesText({ textQuery });
          const classified = classifyPlacesCandidates(candidates, {
            name: w.name,
            area: w.area,
            destination: w.destination,
          });
          return { key: w.dedupeKey, place: fromClassification(w.name, classified) };
        } catch (error) {
          partialFailure = true;
          if (!(error instanceof PlacesProviderError && error.category === "missing_key")) {
            console.info("[planner] places resolve failed", {
              sessionId: params.sessionId,
              category: error instanceof PlacesProviderError ? error.category : "unknown",
            });
          }
          return { key: w.dedupeKey, place: unresolvedPlace(w.name) };
        }
      },
    );

    for (const r of uniqueResults) {
      resolvedByKey.set(r.key, r.place);
    }

    places = capped.map((w) => ({
      dayNumber: w.dayNumber,
      itemOrder: w.itemOrder,
      place: resolvedByKey.get(w.dedupeKey) ?? unresolvedPlace(w.name),
    }));

    try {
      await replacePlaceEnrichmentsForFingerprint({
        sessionId: params.sessionId,
        planFingerprint,
        items: places,
      });
    } catch {
      partialFailure = true;
    }
  }

  const weather = await fetchPlannerWeatherSummary({
    destination,
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
    placeRequestCount,
    routesRequestCount: routeResult.requestCount,
    resolvedPlaceCount,
    ambiguousPlaceCount,
    unresolvedPlaceCount,
    resolvedRouteCount,
    weatherAvailability: weather.availability,
    partialFailure,
  });

  let message: string | null = null;
  if (partialFailure) {
    message = "일부 장소 정보를 확인하지 못했습니다.";
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
