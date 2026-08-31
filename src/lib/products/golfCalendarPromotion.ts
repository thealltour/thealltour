import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export const GOLF_CALENDAR_PROMOTION_CAMPAIGN_SLUG = "promotion";

function normSlug(slug: string | null | undefined): string {
  return (slug ?? "").trim().toLowerCase();
}

/** campaign taxonomy slug=promotion 인 활성 기획 id */
export function resolvePromotionCampaignId(taxonomies: ProductTaxonomy[]): string | null {
  for (const taxonomy of taxonomies) {
    if (taxonomy.taxonomy_type !== "campaign") continue;
    if (!taxonomy.is_active) continue;
    if (normSlug(taxonomy.slug) !== GOLF_CALENDAR_PROMOTION_CAMPAIGN_SLUG) continue;
    const id = taxonomy.id?.trim();
    if (id) return id;
  }
  return null;
}

/** 달력 범례용 promotion campaign 표시 라벨 */
export function resolvePromotionCampaignDisplayLabel(
  taxonomies: ProductTaxonomy[],
): string | null {
  for (const taxonomy of taxonomies) {
    if (taxonomy.taxonomy_type !== "campaign") continue;
    if (!taxonomy.is_active) continue;
    if (normSlug(taxonomy.slug) !== GOLF_CALENDAR_PROMOTION_CAMPAIGN_SLUG) continue;
    const display =
      (typeof taxonomy.display_label === "string" && taxonomy.display_label.trim()) ||
      taxonomy.name?.trim() ||
      "";
    return display || null;
  }
  return null;
}

/** Calendar / listing rows that can resolve promotion campaign membership */
export type PromotionCampaignSource = Pick<
  Product,
  "campaign_card_meta" | "campaigns" | "campaigns_json"
>;

/** 상품에 slug=promotion campaign이 적용되었는지 */
export function productHasPromotionCampaign(
  product: PromotionCampaignSource,
  promotionCampaignId: string | null,
): boolean {
  const promotionId = promotionCampaignId?.trim();
  if (!promotionId) return false;

  for (const meta of product.campaign_card_meta ?? []) {
    if (meta.taxonomyId?.trim() === promotionId) return true;
  }

  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return false;
  for (const item of raw) {
    if (typeof item === "string" && item.trim() === promotionId) return true;
  }

  return false;
}
