import type { Product } from "@/types/product";
import {
  buildProductsKeywordHaystack,
  tokenizeCatalogKeyword,
} from "@/lib/products/productsSearchPolicy";

export function normalizeProductCatalogSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function productCatalogMatchesKeyword(
  product: Pick<Product, "title" | "category" | "theme"> & { description?: string },
  keyword: string,
) {
  if (!keyword) {
    return true;
  }

  const haystack = buildProductsKeywordHaystack(product);

  const tokens = tokenizeCatalogKeyword(keyword);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => haystack.includes(token));
}
