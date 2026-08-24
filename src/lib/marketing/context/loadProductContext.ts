import { collectProductTaxonomyIds, mapProductRowToContext } from "@/lib/marketing/context/mappers/productContextMapper";
import { mapTaxonomyRowToContext } from "@/lib/marketing/context/mappers/taxonomyContextMapper";
import { fetchProductRow } from "@/lib/marketing/context/sources/productSource";
import { fetchTaxonomyRowsByIds } from "@/lib/marketing/context/sources/taxonomySource";
import type { ProductContext, TaxonomyContext } from "@/lib/marketing/context/types";

export async function loadProductContext(productId: string): Promise<ProductContext | null> {
  const row = await fetchProductRow(productId);
  if (!row) return null;

  const taxonomyIds = collectProductTaxonomyIds(row);
  const taxonomyRows = await fetchTaxonomyRowsByIds(taxonomyIds);
  const taxonomiesById = new Map(
    taxonomyRows.flatMap((taxonomyRow) => {
      const taxonomyId = typeof taxonomyRow.id === "string" ? taxonomyRow.id : null;
      return taxonomyId ? [[taxonomyId, taxonomyRow] as const] : [];
    }),
  );
  return mapProductRowToContext(row, taxonomiesById);
}

export async function loadTaxonomyContext(taxonomyId: string): Promise<TaxonomyContext | null> {
  const [row] = await fetchTaxonomyRowsByIds([taxonomyId]);
  return mapTaxonomyRowToContext(row);
}
