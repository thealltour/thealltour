import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

/**
 * 카드 이미지 미설정 시 해당 지역 상품 대표 이미지로 채움. id / 소문자 name → image_url
 */
export function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Product[],
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
