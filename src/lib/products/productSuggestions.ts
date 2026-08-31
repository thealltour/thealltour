/**
 * POST-UI-01D-2B-2: Header product suggestions — slim DB projection + substring ILIKE.
 */

import { supabase } from "@/lib/supabase";
import { escapeForIlike } from "@/lib/search/searchCandidateFilters";
import { quotePostgrestValue } from "@/lib/products/productListingQuery";

export const PRODUCT_SUGGESTIONS_MAX = 8;

/** Match + order columns. description is match-only (not in response). */
export const PRODUCT_SUGGESTION_COLUMN_KEYS = [
  "id",
  "title",
  "description",
  "category",
  "theme",
  "sort_order",
  "created_at",
] as const;

export const PRODUCT_SUGGESTION_SELECT = PRODUCT_SUGGESTION_COLUMN_KEYS.join(",");

export type ProductSuggestionItem = {
  id: string;
  title: string;
  category: string;
  theme: string;
};

/**
 * PostgREST OR: title|description|category|theme ILIKE %q%
 * Uses escapeForIlike + quotePostgrestValue (no unsafe interpolation).
 */
export function buildProductSuggestionOrFilter(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const pattern = `%${escapeForIlike(q)}%`;
  const quoted = quotePostgrestValue(pattern);
  return [
    `title.ilike.${quoted}`,
    `description.ilike.${quoted}`,
    `category.ilike.${quoted}`,
    `theme.ilike.${quoted}`,
  ].join(",");
}

export function mapRowToProductSuggestionItem(
  row: Record<string, unknown>,
): ProductSuggestionItem {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    throw new Error("[suggestions] row missing id");
  }
  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    category: typeof row.category === "string" ? row.category : "",
    theme: typeof row.theme === "string" ? row.theme : "",
  };
}

/**
 * Bounded product title/description/category/theme suggestions.
 * Empty q → [] without DB call.
 */
export async function getProductSuggestionItems(
  rawQuery: string,
): Promise<ProductSuggestionItem[]> {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const orFilter = buildProductSuggestionOrFilter(query);
  if (!orFilter) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SUGGESTION_SELECT)
    .eq("is_active", true)
    .or(orFilter)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(PRODUCT_SUGGESTIONS_MAX);

  if (error) {
    console.error("[suggestions] getProductSuggestionItems error:", error.message);
    throw new Error(`[suggestions] getProductSuggestionItems failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(
    mapRowToProductSuggestionItem,
  );
}
