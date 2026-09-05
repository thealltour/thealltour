import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlannerPlaceEnrichmentItem, PlannerResolvedPlace } from "@/lib/planner/enrichmentTypes";

type EnrichmentRow = {
  day_number: number;
  item_order: number;
  original_name: string;
  resolution_status: string;
  provider_place_id: string | null;
  display_name: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  types_json: unknown;
  provider_url: string | null;
  updated_at: string;
};

/** Display attributes TTL (Google Place Data cache guidance ~30 days). */
export const PLACE_ATTRIBUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function mapRow(row: EnrichmentRow): PlannerPlaceEnrichmentItem {
  const types = Array.isArray(row.types_json)
    ? row.types_json.filter((t): t is string => typeof t === "string")
    : [];
  const place: PlannerResolvedPlace = {
    status: row.resolution_status as PlannerResolvedPlace["status"],
    originalName: row.original_name,
    placeId: row.provider_place_id,
    displayName: row.display_name,
    formattedAddress: row.formatted_address,
    location:
      typeof row.latitude === "number" && typeof row.longitude === "number"
        ? { lat: row.latitude, lng: row.longitude }
        : null,
    types,
    googleMapsUri: row.provider_url,
  };
  return {
    dayNumber: row.day_number,
    itemOrder: row.item_order,
    place,
  };
}

export async function listPlaceEnrichmentsForFingerprint(params: {
  sessionId: string;
  planFingerprint: string;
}): Promise<{ items: PlannerPlaceEnrichmentItem[]; fresh: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("planner_place_enrichments")
    .select(
      "day_number, item_order, original_name, resolution_status, provider_place_id, display_name, formatted_address, latitude, longitude, types_json, provider_url, updated_at",
    )
    .eq("planner_session_id", params.sessionId)
    .eq("plan_fingerprint", params.planFingerprint);

  if (error) {
    console.error("[planner] listPlaceEnrichments:", error.message);
    return { items: [], fresh: false };
  }

  const rows = (data ?? []) as EnrichmentRow[];
  if (rows.length === 0) return { items: [], fresh: false };

  const oldest = rows.reduce((min, r) => {
    const t = Date.parse(r.updated_at);
    return Number.isFinite(t) ? Math.min(min, t) : min;
  }, Date.now());

  const fresh = Date.now() - oldest < PLACE_ATTRIBUTE_CACHE_TTL_MS;
  return { items: rows.map(mapRow), fresh };
}

export async function replacePlaceEnrichmentsForFingerprint(params: {
  sessionId: string;
  planFingerprint: string;
  items: Array<{
    dayNumber: number;
    itemOrder: number;
    place: PlannerResolvedPlace;
  }>;
}): Promise<void> {
  const now = new Date().toISOString();

  // Remove prior rows for this fingerprint then insert (simple replace)
  await supabaseAdmin
    .from("planner_place_enrichments")
    .delete()
    .eq("planner_session_id", params.sessionId)
    .eq("plan_fingerprint", params.planFingerprint);

  if (params.items.length === 0) return;

  const rows = params.items.map((item) => ({
    planner_session_id: params.sessionId,
    day_number: item.dayNumber,
    item_order: item.itemOrder,
    original_name: item.place.originalName,
    resolution_status: item.place.status,
    provider: "google_places",
    provider_place_id: item.place.placeId,
    display_name: item.place.displayName,
    formatted_address: item.place.formattedAddress,
    latitude: item.place.location?.lat ?? null,
    longitude: item.place.location?.lng ?? null,
    types_json: item.place.types,
    provider_url: item.place.googleMapsUri,
    plan_fingerprint: params.planFingerprint,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabaseAdmin.from("planner_place_enrichments").insert(rows);
  if (error) {
    console.error("[planner] replacePlaceEnrichments:", error.message);
    throw new Error("Failed to save place enrichments");
  }
}
