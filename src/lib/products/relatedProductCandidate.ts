/**
 * POST-UI-01D-2B-1: Slim Related candidate projection — full active universe, score-only width.
 */

import { supabase } from "@/lib/supabase";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { getProductListItems } from "@/lib/products/getProductListItems";
import {
  PRODUCT_LISTING_SELECT,
  type CampaignHydratableProduct,
  type ProductListItem,
} from "@/lib/products/productListItem";
import { getRelatedProducts } from "@/lib/products/getRelatedProducts";
import type { RelatedScorableProduct } from "@/lib/products/relatedProductScoring";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

/** Score + promotion fields only — no card/PDP blobs. */
export const RELATED_CANDIDATE_COLUMN_KEYS = [
  "id",
  "destination_id",
  "product_line_id",
  "category",
  "theme",
  "created_at",
  "campaigns_json",
] as const;

export const RELATED_CANDIDATE_SELECT = RELATED_CANDIDATE_COLUMN_KEYS.join(",");

/** Heavy / card fields that must not appear in Stage-1 select. */
export const RELATED_CANDIDATE_EXCLUDED_COLUMNS = [
  "description",
  "itinerary",
  "itinerary_days",
  "itinerary_days_json",
  "itinerary_v2_json",
  "itinerary_media_json",
  "overview_json",
  "package_catalog_json",
  "golf_courses_json",
  "selling_points_json",
  "options",
  "departure_schedules_json",
  "images_json",
  "image_url",
  "title",
  "price",
  "is_popular",
  "is_recommend",
] as const;

/** PostgREST default max rows — chunk to avoid silent truncation. */
export const RELATED_CANDIDATE_CHUNK_SIZE = 500;

/**
 * Stage-1 Related candidate.
 * is_popular / is_recommend optional for score 0-diff (DB columns absent → undefined → falsy).
 */
export type RelatedCandidate = RelatedScorableProduct & CampaignHydratableProduct;

export type RelatedCandidateRow = Record<string, unknown>;

function asOptionalString(value: unknown): string | null | undefined {
  if (value == null) return value === null ? null : undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

export function mapRowToRelatedCandidate(row: RelatedCandidateRow): RelatedCandidate {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    throw new Error("[related] RelatedCandidate row missing id");
  }

  const meta = row.campaign_card_meta;
  const campaign_card_meta = Array.isArray(meta)
    ? (meta as ProductCampaignCardMeta[])
    : undefined;

  return {
    id,
    destination_id: asOptionalString(row.destination_id),
    product_line_id: asOptionalString(row.product_line_id),
    category: asOptionalString(row.category),
    theme: asOptionalString(row.theme),
    created_at: asOptionalString(row.created_at),
    campaigns_json: row.campaigns_json as CampaignHydratableProduct["campaigns_json"],
    campaign_card_meta,
    // DB columns absent — leave undefined so score treats as falsy (0-diff)
    is_popular: typeof row.is_popular === "boolean" ? row.is_popular : undefined,
    is_recommend: typeof row.is_recommend === "boolean" ? row.is_recommend : undefined,
  };
}

/**
 * Full active catalog × RelatedCandidate slim projection.
 * Chunked range fetch — no arbitrary universe cap.
 */
export async function getRelatedProductCandidates(): Promise<RelatedCandidate[]> {
  const out: RelatedCandidate[] = [];
  let from = 0;

  for (;;) {
    const to = from + RELATED_CANDIDATE_CHUNK_SIZE - 1;
    const { data, error } = await supabase
      .from("products")
      .select(RELATED_CANDIDATE_SELECT)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("[related] getRelatedProductCandidates error:", error.message);
      throw new Error(`[related] getRelatedProductCandidates failed: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as RelatedCandidateRow[];
    for (const row of rows) {
      out.push(mapRowToRelatedCandidate(row));
    }

    if (rows.length < RELATED_CANDIDATE_CHUNK_SIZE) break;
    from += RELATED_CANDIDATE_CHUNK_SIZE;
  }

  return out;
}

/** Fail-fast order restore (Search ranked-page pattern). */
export function restoreRelatedProductListItemOrderByIds(
  ids: string[],
  items: ProductListItem[],
): ProductListItem[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    console.error("[related] final listing missing products:", missing.join(", "));
    throw new Error(`[related] final listing missing products: ${missing.join(", ")}`);
  }
  return ids.map((id) => byId.get(id)!);
}

/**
 * PDP Related orchestrator:
 * slim candidates → hydrate → score/fallback → listing fetch → order restore.
 */
export async function loadRelatedProductListItems(
  currentProduct: RelatedScorableProduct,
  limit = 6,
): Promise<ProductListItem[]> {
  if (!currentProduct?.id?.trim()) return [];

  const [candidates, campaignTaxonomies] = await Promise.all([
    getRelatedProductCandidates(),
    getCampaignTaxonomiesForCard(),
  ]);

  const hydrated = hydrateProductsWithCampaignCardMeta(candidates, campaignTaxonomies);
  const related = getRelatedProducts({
    currentProduct,
    allProducts: hydrated,
    limit,
  });
  const ids = related.map((p) => p.id);
  if (ids.length === 0) return [];

  const rawItems = await getProductListItems({
    ids,
    limit: ids.length,
    hydrateCampaign: false,
  });
  const items = hydrateProductsWithCampaignCardMeta(rawItems, campaignTaxonomies);
  return restoreRelatedProductListItemOrderByIds(ids, items);
}

/** Test / docs: Stage-2 uses listing select only. */
export function relatedStage2ListingSelect(): string {
  return PRODUCT_LISTING_SELECT;
}
