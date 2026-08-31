/**
 * Build destination card fallback images from a bounded ProductListItem pool
 * (not full catalog). Prefer taxonomy card_image_url at call site.
 */
import type { ProductCardSource } from "@/lib/products/productListItem";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Array<Pick<ProductCardSource, "image_url" | "destination_id" | "category">>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        (p.destination_id === d.id ||
          p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()),
    );
    if (first?.image_url?.trim()) {
      map.set(d.id, first.image_url.trim());
      map.set(d.name.trim().toLowerCase(), first.image_url.trim());
    }
  }
  return map;
}
