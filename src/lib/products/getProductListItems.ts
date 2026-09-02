/**
 * POST-UI-01D-2A: Bounded ProductListItem fetch for Hub / Landing previews.
 * Not a pagination helper — do not use getProductsPage for preview limits.
 */

import { supabase } from "@/lib/supabase";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  mapProductRowToListItem,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";
import {
  applyProductListingDbFilters,
  buildDestinationScopeOrFilter,
  buildGolfOrFilter,
  buildThemeOrFilter,
  normalizeProductListingDbFilters,
  quotePostgrestValue,
  type ProductListingDbFilters,
} from "@/lib/products/productListingQuery";

export type ProductListItemsOrder = "catalog";

export type GetProductListItemsParams = {
  /** Required positive limit (preview / landing caps). */
  limit: number;
  /** Default: catalog order (sort_order ASC, created_at DESC). */
  order?: ProductListItemsOrder;
  /**
   * Hub destination preview: destination_id === id OR category equals name (case-insensitive).
   * Does NOT include descendants.
   */
  destinationSelfExact?: { id: string; name: string };
  /** Destination slug / region page related: category equals name only (case-insensitive). */
  categoryExact?: string;
  /** Theme hub/slug: exact theme token boundary match (single name, no descendants). */
  themeTokenExact?: string;
  /** productLanding region: self + descendants. */
  destinationScope?: { ids: string[]; names: string[] };
  /** productLanding theme: self + descendant theme names (token OR). */
  themeNames?: string[];
  /** LandingPageRenderer: destination_id exact only. */
  destinationIdExact?: string;
  /** Optional golf channel OR (product_line_id / legacy category). */
  golfChannel?: {
    productLineIds: string[];
    legacyCategories: string[];
  };
  /** Fetch specific ids (order not preserved — caller restores). */
  ids?: string[];
  hydrateCampaign?: boolean;
};

export type CountProductListItemsParams = Omit<
  GetProductListItemsParams,
  "limit" | "order" | "ids" | "hydrateCampaign"
>;

function applyCatalogOrder<T extends {
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => T;
}>(query: T): T {
  return query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });
}

/**
 * Apply filters. Returns null when the filter set matches nothing (empty result).
 */
function applyParamsFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: GetProductListItemsParams | CountProductListItemsParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  let q = query;

  if ("ids" in params && params.ids?.length) {
    q = q.in("id", params.ids);
  }

  if (params.destinationSelfExact) {
    const id = params.destinationSelfExact.id.trim();
    const name = params.destinationSelfExact.name.trim();
    const parts: string[] = [];
    if (id) parts.push(`destination_id.eq.${quotePostgrestValue(id)}`);
    if (name) parts.push(`category.ilike.${quotePostgrestValue(name)}`);
    if (!parts.length) return null;
    q = q.or(parts.join(","));
  } else if (params.categoryExact?.trim()) {
    q = q.ilike("category", params.categoryExact.trim());
  } else if (params.themeTokenExact?.trim()) {
    const themeOr = buildThemeOrFilter([params.themeTokenExact.trim()]);
    if (!themeOr) return null;
    q = q.or(themeOr);
  } else if (params.destinationIdExact?.trim()) {
    q = q.eq("destination_id", params.destinationIdExact.trim());
  }

  const listingFilters: ProductListingDbFilters = {};
  if (params.destinationScope) {
    listingFilters.destinationScope = params.destinationScope;
  }
  if (params.themeNames?.length) {
    listingFilters.themeNames = params.themeNames;
  }
  if (params.golfChannel) {
    listingFilters.golfChannel = params.golfChannel;
  }

  const hasListing =
    Boolean(params.destinationScope) ||
    Boolean(params.themeNames?.length) ||
    Boolean(params.golfChannel);

  if (hasListing) {
    const normalized = normalizeProductListingDbFilters(listingFilters);
    if (normalized.matchNone) return null;
    // When destinationIdExact already applied, only apply golfChannel from listing filters
    if (params.destinationIdExact?.trim() && params.golfChannel) {
      const golfOr = buildGolfOrFilter(params.golfChannel);
      if (golfOr) q = q.or(golfOr);
    } else if (!params.destinationIdExact) {
      q = applyProductListingDbFilters(q, normalized);
    }
  }

  return q;
}

async function mapAndMaybeHydrate(
  rows: Record<string, unknown>[],
  hydrate: boolean,
): Promise<ProductListItem[]> {
  const mapped = rows.map((row) => mapProductRowToListItem(row));
  if (!hydrate) return mapped;
  const campaignTaxonomies = await getCampaignTaxonomiesForCard();
  return hydrateProductsWithCampaignCardMeta(mapped, campaignTaxonomies);
}

/**
 * Bounded listing fetch for Hub / Landing previews.
 * Uses PRODUCT_LISTING_SELECT only — never select("*").
 */
export async function getProductListItems(
  params: GetProductListItemsParams,
): Promise<ProductListItem[]> {
  const limit = Math.max(0, Math.floor(params.limit));
  if (limit === 0) return [];
  if (params.ids && params.ids.length === 0) return [];

  let query = supabase
    .from("products")
    .select(PRODUCT_LISTING_SELECT)
    .eq("is_active", true);

  const filtered = applyParamsFilters(query, params);
  if (filtered === null) return [];
  query = filtered;

  query = applyCatalogOrder(query).limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[products] getProductListItems error:", error.message);
    throw new Error(`[products] getProductListItems failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return mapAndMaybeHydrate(rows, params.hydrateCampaign !== false);
}

/** Exact matched universe count (productLanding productCount). */
export async function countProductListItems(
  params: CountProductListItemsParams,
): Promise<number> {
  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const filtered = applyParamsFilters(query, params);
  if (filtered === null) return 0;
  query = filtered;

  const { count, error } = await query;
  if (error) {
    console.error("[products] countProductListItems error:", error.message);
    throw new Error(`[products] countProductListItems failed: ${error.message}`);
  }
  return typeof count === "number" ? count : 0;
}

/** Restore curated id order after `.in()` fetch. */
export function restoreProductListItemOrderByIds(
  ids: string[],
  items: ProductListItem[],
): ProductListItem[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductListItem => Boolean(p));
}

export { buildDestinationScopeOrFilter, buildThemeOrFilter };
