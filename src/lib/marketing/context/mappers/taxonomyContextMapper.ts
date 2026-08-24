import { asString } from "@/lib/marketing/context/json";
import type { TaxonomyContext } from "@/lib/marketing/context/types";

export type ProductTaxonomyRow = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  taxonomy_type?: unknown;
  parent_id?: unknown;
  display_label?: unknown;
  badge_description?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
};

export function mapTaxonomyRowToContext(row: ProductTaxonomyRow | null | undefined): TaxonomyContext | null {
  if (!row) return null;
  const id = asString(row.id);
  const name = asString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    slug: asString(row.slug),
    taxonomyType: asString(row.taxonomy_type) ?? "",
    parentId: asString(row.parent_id),
    displayLabel: asString(row.display_label),
    badgeDescription: asString(row.badge_description),
    seoTitle: asString(row.seo_title),
    seoDescription: asString(row.seo_description),
  };
}
