import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlannerRouteEnrichment } from "@/lib/planner/enrichmentTypes";

type RouteRow = {
  day_number: number;
  from_item_order: number;
  to_item_order: number;
  route_status: string;
  travel_mode: string;
  duration_minutes: number | null;
  distance_meters: number | null;
  updated_at: string;
};

/** Same TTL as place display attributes (~30 days). */
export const ROUTE_ATTRIBUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function mapRow(row: RouteRow): PlannerRouteEnrichment {
  return {
    day: row.day_number,
    fromOrder: row.from_item_order,
    toOrder: row.to_item_order,
    status: row.route_status as PlannerRouteEnrichment["status"],
    mode: row.travel_mode as PlannerRouteEnrichment["mode"],
    durationMinutes: row.duration_minutes,
    distanceMeters: row.distance_meters,
    provider: "google_routes",
  };
}

export async function listRouteEnrichmentsForFingerprint(params: {
  sessionId: string;
  planFingerprint: string;
}): Promise<{ items: PlannerRouteEnrichment[]; fresh: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("planner_route_enrichments")
    .select(
      "day_number, from_item_order, to_item_order, route_status, travel_mode, duration_minutes, distance_meters, updated_at",
    )
    .eq("planner_session_id", params.sessionId)
    .eq("plan_fingerprint", params.planFingerprint);

  if (error) {
    console.error("[planner] listRouteEnrichments:", error.message);
    return { items: [], fresh: false };
  }

  const rows = (data ?? []) as RouteRow[];
  if (rows.length === 0) return { items: [], fresh: false };

  const oldest = rows.reduce((min, r) => {
    const t = Date.parse(r.updated_at);
    return Number.isFinite(t) ? Math.min(min, t) : min;
  }, Date.now());

  const fresh = Date.now() - oldest < ROUTE_ATTRIBUTE_CACHE_TTL_MS;
  return { items: rows.map(mapRow), fresh };
}

export async function replaceRouteEnrichmentsForFingerprint(params: {
  sessionId: string;
  planFingerprint: string;
  items: PlannerRouteEnrichment[];
}): Promise<void> {
  const now = new Date().toISOString();

  await supabaseAdmin
    .from("planner_route_enrichments")
    .delete()
    .eq("planner_session_id", params.sessionId)
    .eq("plan_fingerprint", params.planFingerprint);

  if (params.items.length === 0) return;

  const rows = params.items.map((item) => ({
    planner_session_id: params.sessionId,
    day_number: item.day,
    from_item_order: item.fromOrder,
    to_item_order: item.toOrder,
    route_status: item.status,
    travel_mode: item.mode,
    duration_minutes: item.durationMinutes,
    distance_meters: item.distanceMeters,
    provider: "google_routes",
    plan_fingerprint: params.planFingerprint,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabaseAdmin.from("planner_route_enrichments").insert(rows);
  if (error) {
    console.error("[planner] replaceRouteEnrichments:", error.message);
    throw new Error("Failed to save route enrichments");
  }
}
