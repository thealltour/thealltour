import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import type { Product } from "@/types/product";
import { getSeasonalPriceDisplayModel } from "@/lib/products/detailSeasonalPriceDisplay";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";

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
  const hasDepartureData = Boolean(
    product.departureSchedules?.length ||
      product.departures?.length ||
      product.departure_from_date?.trim() ||
      product.departure_to_date?.trim(),
  );
  // 상품 상세 출발일은 특가/기획(promotion_fixed) 포함 달력 UI 통일
  if (hasDepartureData) return "calendar";
  return "chips";
}

/** 출발일·인원·옵션 선택 UI를 띄울 데이터가 있는지 */
export function productHasBookingSelection(product: Product | null | undefined): boolean {
  if (!product) return false;
  const hasCalendarDates = collectProductDepartureDates(product).length > 0;
  const hasDepartures = Boolean(product.departureSchedules?.length || product.departures?.length);
  const hasOptions =
    ENABLE_PRODUCT_OPTIONS && Boolean(product.options?.groups && product.options.groups.length > 0);
  return hasCalendarDates || hasDepartures || hasOptions;
}
