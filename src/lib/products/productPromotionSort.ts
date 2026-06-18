import type { Product } from "@/types/product";

/** campaign_card_meta의 slug=promotion 배지가 노출되는 상품 */
export function productHasPromotionFromMeta(product: Product): boolean {
  return (product.campaign_card_meta ?? []).some(
    (m) => m.isPromotionCampaign === true && m.badge_visible === true,
  );
}

/** promotion 상품을 앞으로 — 각 그룹 내 기존 순서 유지 */
export function sortProductsPromotionFirst<T extends Product>(products: T[]): T[] {
  const promos: T[] = [];
  const rest: T[] = [];
  for (const p of products) {
    if (productHasPromotionFromMeta(p)) promos.push(p);
    else rest.push(p);
  }
  return [...promos, ...rest];
}
