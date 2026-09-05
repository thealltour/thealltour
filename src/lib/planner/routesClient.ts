import "server-only";

import { getGoogleMapsApiKey } from "@/lib/planner/placesClient";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.duration,routes.distanceMeters";

export class RoutesProviderError extends Error {
  readonly category: "missing_key" | "http" | "network" | "parse" | "empty";

  constructor(category: RoutesProviderError["category"], message: string) {
    super(message);
    this.name = "RoutesProviderError";
    this.category = category;
  }
}

export type ComputeRouteResult = {
  durationMinutes: number;
  distanceMeters: number;
};

function parseDurationSeconds(duration: unknown): number | null {
  if (typeof duration === "number" && Number.isFinite(duration)) return duration;
  if (typeof duration === "string") {
    // "123s"
    const m = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Google Routes API Compute Routes — server only.
 * Minimal field mask: duration + distanceMeters (no polyline).
 */
export async function computeRouteSegment(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travelMode: "WALK" | "DRIVE" | "TRANSIT";
  departureTimeIso?: string | null;
}): Promise<ComputeRouteResult> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new RoutesProviderError("missing_key", "GOOGLE_MAPS_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    origin: {
      location: { latLng: { latitude: params.origin.lat, longitude: params.origin.lng } },
    },
    destination: {
      location: {
        latLng: { latitude: params.destination.lat, longitude: params.destination.lng },
      },
    },
    travelMode: params.travelMode,
    languageCode: "ko",
    units: "METRIC",
  };

  if (params.travelMode === "TRANSIT" && params.departureTimeIso) {
    body.departureTime = params.departureTimeIso;
  }

  let res: Response;
  try {
    res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new RoutesProviderError("network", "Routes network error");
  }

  if (!res.ok) {
    throw new RoutesProviderError("http", `Routes HTTP ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new RoutesProviderError("parse", "Routes JSON parse failed");
  }

  const routes = (json as { routes?: Array<{ duration?: unknown; distanceMeters?: unknown }> })
    .routes;
  const route = Array.isArray(routes) ? routes[0] : null;
  if (!route) {
    throw new RoutesProviderError("empty", "No routes returned");
  }

  const seconds = parseDurationSeconds(route.duration);
  const distanceMeters =
    typeof route.distanceMeters === "number" && Number.isFinite(route.distanceMeters)
      ? Math.round(route.distanceMeters)
      : null;

  if (seconds == null || distanceMeters == null) {
    throw new RoutesProviderError("parse", "Missing duration/distance");
  }

  return {
    durationMinutes: Math.max(1, Math.round(seconds / 60)),
    distanceMeters,
  };
}
