import { collectProductTaxonomyIds, mapProductRowToContext } from "@/lib/marketing/context/mappers/productContextMapper";
import { mapTaxonomyRowToContext } from "@/lib/marketing/context/mappers/taxonomyContextMapper";
import { fetchProductRow, fetchProductRows } from "@/lib/marketing/context/sources/productSource";
import { fetchTaxonomyRowsByIds } from "@/lib/marketing/context/sources/taxonomySource";
import type { ProductContext, TaxonomyContext } from "@/lib/marketing/context/types";

export async function loadProductContext(productId: string): Promise<ProductContext | null> {
  const row = await fetchProductRow(productId);
  if (!row) return null;
  const taxonomiesById = await loadTaxonomiesByIds(collectProductTaxonomyIds(row));
  return mapProductRowToContext(row, taxonomiesById);
}

export type LoadProductContextsInput = {
  ids?: string[];
  activeOnly?: boolean;
  limit: number;
};

/** One products query + one taxonomy query. Reuses mapProductRowToContext. */
export async function loadProductContexts(input: LoadProductContextsInput): Promise<ProductContext[]> {
  const rows = await fetchProductRows(input);
  const taxonomyIds = [...new Set(rows.flatMap((row) => collectProductTaxonomyIds(row)))];
  const taxonomiesById = await loadTaxonomiesByIds(taxonomyIds);
  const mapped = rows
    .map((row) => mapProductRowToContext(row, taxonomiesById))
    .filter((product): product is ProductContext => product != null);
  if (!input.ids || input.ids.length === 0) return mapped;
  const byId = new Map(mapped.map((product) => [product.id, product]));
  return input.ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}

async function loadTaxonomiesByIds(taxonomyIds: string[]) {
  const taxonomyRows = await fetchTaxonomyRowsByIds(taxonomyIds);
  return new Map(
    taxonomyRows.flatMap((taxonomyRow) => {
      const taxonomyId = typeof taxonomyRow.id === "string" ? taxonomyRow.id : null;
      return taxonomyId ? [[taxonomyId, taxonomyRow] as const] : [];
    }),
  );
}

export async function loadTaxonomyContext(taxonomyId: string): Promise<TaxonomyContext | null> {
  const [row] = await fetchTaxonomyRowsByIds([taxonomyId]);
  return mapTaxonomyRowToContext(row);
}
