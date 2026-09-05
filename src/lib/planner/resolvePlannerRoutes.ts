import "server-only";

import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type {
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
} from "@/lib/planner/enrichmentTypes";
import { mapWithConcurrency } from "@/lib/planner/placesClient";
import {
  buildConsecutiveRoutePairs,
  PLANNER_ROUTE_CONCURRENCY,
  PLANNER_ROUTE_RESOLVE_MAX,
} from "@/lib/planner/routePairs";
import { computeRouteSegment, RoutesProviderError } from "@/lib/planner/routesClient";
import {
  listRouteEnrichmentsForFingerprint,
  replaceRouteEnrichmentsForFingerprint,
} from "@/lib/planner/routeEnrichmentRepository";

export { PLANNER_ROUTE_CONCURRENCY, PLANNER_ROUTE_RESOLVE_MAX };

export async function resolvePlannerRoutes(params: {
  sessionId: string;
  plan: PlannerPlan;
  planFingerprint: string;
  places: PlannerPlaceEnrichmentItem[];
}): Promise<{ routes: PlannerRouteEnrichment[]; partialFailure: boolean; requestCount: number }> {
  const existing = await listRouteEnrichmentsForFingerprint({
    sessionId: params.sessionId,
    planFingerprint: params.planFingerprint,
  });

  if (existing.fresh && existing.items.length > 0) {
    return { routes: existing.items, partialFailure: false, requestCount: 0 };
  }

  const pairs = buildConsecutiveRoutePairs({
    plan: params.plan,
    places: params.places,
  }).slice(0, PLANNER_ROUTE_RESOLVE_MAX);

  let partialFailure = false;
  let requestCount = 0;

  const uniqueKeys = [...new Set(pairs.map((p) => p.dedupeKey))];
  const resultByKey = new Map<
    string,
    {
      status: PlannerRouteEnrichment["status"];
      durationMinutes: number | null;
      distanceMeters: number | null;
    }
  >();

  const uniquePairs = uniqueKeys.map((key) => pairs.find((p) => p.dedupeKey === key)!);

  await mapWithConcurrency(uniquePairs, PLANNER_ROUTE_CONCURRENCY, async (pair) => {
    if (!pair.googleTravelMode) {
      resultByKey.set(pair.dedupeKey, {
        status: "unavailable",
        durationMinutes: null,
        distanceMeters: null,
      });
      return;
    }

    requestCount += 1;
    try {
      const result = await computeRouteSegment({
        origin: pair.from,
        destination: pair.to,
        travelMode: pair.googleTravelMode,
        departureTimeIso: pair.departureTimeIso,
      });
      resultByKey.set(pair.dedupeKey, {
        status: "resolved",
        durationMinutes: result.durationMinutes,
        distanceMeters: result.distanceMeters,
      });
    } catch (error) {
      partialFailure = true;
      if (!(error instanceof RoutesProviderError && error.category === "missing_key")) {
        console.info("[planner] routes resolve failed", {
          sessionId: params.sessionId,
          category: error instanceof RoutesProviderError ? error.category : "unknown",
        });
      }
      resultByKey.set(pair.dedupeKey, {
        status: "failed",
        durationMinutes: null,
        distanceMeters: null,
      });
    }
  });

  const routes: PlannerRouteEnrichment[] = pairs.map((pair) => {
    const r = resultByKey.get(pair.dedupeKey);
    return {
      day: pair.day,
      fromOrder: pair.fromOrder,
      toOrder: pair.toOrder,
      status: r?.status ?? "failed",
      mode: pair.mode,
      durationMinutes: r?.durationMinutes ?? null,
      distanceMeters: r?.distanceMeters ?? null,
      provider: "google_routes",
    };
  });

  try {
    await replaceRouteEnrichmentsForFingerprint({
      sessionId: params.sessionId,
      planFingerprint: params.planFingerprint,
      items: routes,
    });
  } catch {
    partialFailure = true;
  }

  return { routes, partialFailure, requestCount };
}
