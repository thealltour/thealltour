import type { Product } from "@/types/product";
import { getSeasonalPriceDisplayModel } from "@/lib/products/detailSeasonalPriceDisplay";

export type ProductBookingUxMode =
  | "seasonal_consult"
  | "promotion_fixed"
  | "calendar_booking";

/** seasonal_price_bands 또는 promotion 캠페인 상품 */
export function isSeasonOrPromotionProduct(product: Product): boolean {
  return resolveProductBookingUxMode(product) !== "calendar_booking";
}

/** promotion campaign taxonomy (campaign_card_meta.isPromotionCampaign) */
export function productHasPromotionCampaignMeta(product: Product): boolean {
  for (const meta of product.campaign_card_meta ?? []) {
    if (meta.isPromotionCampaign) return true;
  }
  return false;
}

export function resolveProductBookingUxMode(product: Product): ProductBookingUxMode {
  const seasonal = getSeasonalPriceDisplayModel(product.seasonal_price_bands);
  if (seasonal.hasAny) return "seasonal_consult";

  const hasSchedules = Boolean(
    product.departureSchedules?.length || product.departures?.length,
  );
  if (productHasPromotionCampaignMeta(product) && hasSchedules) {
    return "promotion_fixed";
  }

  return "calendar_booking";
}

export function resolveDepartureUiForProduct(product: Product): "chips" | "calendar" {
  const mode = resolveProductBookingUxMode(product);
  return mode === "calendar_booking" ? "calendar" : "chips";
}
