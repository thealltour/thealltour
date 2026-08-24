import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ProductTaxonomyRow } from "@/lib/marketing/context/mappers/taxonomyContextMapper";

const TAXONOMY_CONTEXT_COLUMNS = [
  "id",
  "name",
  "slug",
  "taxonomy_type",
  "parent_id",
  "display_label",
  "badge_description",
  "seo_title",
  "seo_description",
].join(", ");

export async function fetchTaxonomyRowsByIds(ids: string[]): Promise<ProductTaxonomyRow[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("product_taxonomies")
    .select(TAXONOMY_CONTEXT_COLUMNS)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`product_taxonomies lookup failed: ${error.message}`);
  }
  return (data as ProductTaxonomyRow[] | null) ?? [];
}
