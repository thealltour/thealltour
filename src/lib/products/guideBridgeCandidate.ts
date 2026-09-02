/**
 * POST-UI-01D-3B: Slim Guide bridge candidate — full active universe, score-only width.
 */

import { supabase } from "@/lib/supabase";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { getProductListItems } from "@/lib/products/getProductListItems";
import {
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";
import {
  buildGuideRecommendationContext,
  computeGuideBridgeRecommendations,
  type GuideBridgeRecommendationsOptions,
  type GuideBridgeProductDebugEntry,
  type GuideScorableProduct,
} from "@/lib/products/guideBridgeScoring";
import type { Guide } from "@/types/guide";

/** Score + fallback ordering fields only — no card/PDP blobs. */
export const GUIDE_BRIDGE_CANDIDATE_COLUMN_KEYS = [
  "id",
  "destination_id",
  "category",
  "theme",
  "title",
  "description",
  "sort_order",
  "created_at",
] as const;

export const GUIDE_BRIDGE_CANDIDATE_SELECT = GUIDE_BRIDGE_CANDIDATE_COLUMN_KEYS.join(",");

/** Heavy / card fields that must not appear in Stage-1 select. */
export const GUIDE_BRIDGE_CANDIDATE_EXCLUDED_COLUMNS = [
  "price",
  "images_json",
  "image_url",
  "meta_info",
  "overview_accommodation",
  "overview_region",
  "overview_duration",
  "overview_json",
  "campaigns_json",
  "departure_schedules_json",
  "itinerary",
  "itinerary_days",
  "itinerary_days_json",
  "itinerary_v2_json",
  "itinerary_media_json",
  "package_catalog_json",
  "golf_courses_json",
  "selling_points_json",
  "options",
  "notes",
] as const;

/** PostgREST default max rows — chunk to avoid silent truncation. */
export const GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE = 500;

export type GuideBridgeCandidate = GuideScorableProduct;

export type GuideBridgeCandidateRow = Record<string, unknown>;

export type GuideBridgeRecommendations = {
  /** score > 0 상위 3 (soft diversity 적용, 폴백 미포함) */
  primary: ProductListItem[];
  /** 그 다음 score > 0 최대 6건 (동일 규칙) */
  secondary: ProductListItem[];
  /** score === 0 전체(정렬 순). `all` 끝에서만 보충 */
  fallback: ProductListItem[];
  /** primary + secondary + 남은 양수 점수 + 폴백, totalLimit까지 */
  all: ProductListItem[];
  debug?: GuideBridgeProductDebugEntry[];
};

function asOptionalString(value: unknown): string | null | undefined {
  if (value == null) return value === null ? null : undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

function asOptionalNumber(value: unknown): number | null | undefined {
  if (value == null) return value === null ? null : undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function mapRowToGuideBridgeCandidate(row: GuideBridgeCandidateRow): GuideBridgeCandidate {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    throw new Error("[guide-bridge] GuideBridgeCandidate row missing id");
  }

  const title = typeof row.title === "string" ? row.title : "";
  if (!title.trim()) {
    throw new Error(`[guide-bridge] GuideBridgeCandidate row missing title: ${id}`);
  }

  return {
    id,
    destination_id: asOptionalString(row.destination_id),
    category: asOptionalString(row.category),
    theme: asOptionalString(row.theme),
    title,
    description: asOptionalString(row.description),
    sort_order: asOptionalNumber(row.sort_order),
    created_at: asOptionalString(row.created_at),
  };
}

/**
 * Full active catalog × GuideBridgeCandidate slim projection.
 * Chunked range fetch — no arbitrary universe cap, no bounded prefilter.
 */
export async function getGuideBridgeCandidates(): Promise<GuideBridgeCandidate[]> {
  const out: GuideBridgeCandidate[] = [];
  let from = 0;

  for (;;) {
    const to = from + GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE - 1;
    const { data, error } = await supabase
      .from("products")
      .select(GUIDE_BRIDGE_CANDIDATE_SELECT)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("[guide-bridge] getGuideBridgeCandidates error:", error.message);
      throw new Error(`[guide-bridge] getGuideBridgeCandidates failed: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as GuideBridgeCandidateRow[];
    for (const row of rows) {
      out.push(mapRowToGuideBridgeCandidate(row));
    }

    if (rows.length < GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE) break;
    from += GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE;
  }

  return out;
}

/** Fail-fast order restore (Related / Search ranked-page pattern). */
export function restoreGuideBridgeProductListItemOrderByIds(
  ids: string[],
  items: ProductListItem[],
): ProductListItem[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    console.error("[guide-bridge] final listing missing products:", missing.join(", "));
    throw new Error(`[guide-bridge] final listing missing products: ${missing.join(", ")}`);
  }
  return ids.map((id) => byId.get(id)!);
}

/** Fallback array is metadata-only — slim fields, no Stage-2 listing fetch. */
function candidateToFallbackListItem(candidate: GuideBridgeCandidate): ProductListItem {
  return {
    id: candidate.id,
    title: candidate.title,
    ...(candidate.category != null ? { category: candidate.category } : {}),
    ...(candidate.theme != null ? { theme: candidate.theme } : {}),
    ...(candidate.destination_id != null ? { destination_id: candidate.destination_id } : {}),
  } as ProductListItem;
}

/** Test / docs: Stage-2 uses listing select only. */
export function guideBridgeStage2ListingSelect(): string {
  return PRODUCT_LISTING_SELECT;
}

/**
 * Guide bridge orchestrator:
 * slim candidates → score/diversity/fallback → listing fetch → order restore → hydrate.
 */
export async function getGuideBridgeRecommendations(
  guide: Guide,
  options?: GuideBridgeRecommendationsOptions,
): Promise<GuideBridgeRecommendations> {
  const candidates = await getGuideBridgeCandidates();
  if (candidates.length === 0) {
    return { primary: [], secondary: [], fallback: [], all: [] };
  }

  const ctx = await buildGuideRecommendationContext(guide);
  const selection = computeGuideBridgeRecommendations(candidates, ctx, options);

  const cardIds = selection.all.map((p) => p.id);
  if (cardIds.length === 0) {
    return {
      primary: [],
      secondary: [],
      fallback: selection.fallback.map(candidateToFallbackListItem),
      all: [],
      ...(selection.debug ? { debug: selection.debug } : {}),
    };
  }

  const [rawItems, campaignTaxonomies] = await Promise.all([
    getProductListItems({ ids: cardIds, limit: cardIds.length, hydrateCampaign: false }),
    getCampaignTaxonomiesForCard(),
  ]);
  const items = hydrateProductsWithCampaignCardMeta(rawItems, campaignTaxonomies);

  const primaryIds = selection.primary.map((p) => p.id);
  const secondaryIds = selection.secondary.map((p) => p.id);
  const allIds = selection.all.map((p) => p.id);

  return {
    primary: restoreGuideBridgeProductListItemOrderByIds(primaryIds, items),
    secondary: restoreGuideBridgeProductListItemOrderByIds(secondaryIds, items),
    fallback: selection.fallback.map(candidateToFallbackListItem),
    all: restoreGuideBridgeProductListItemOrderByIds(allIds, items),
    ...(selection.debug ? { debug: selection.debug } : {}),
  };
}
