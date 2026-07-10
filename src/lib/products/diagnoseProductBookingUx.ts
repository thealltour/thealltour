import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";
import {
  productHasPromotionCampaignMeta,
  resolveDepartureUiForProduct,
  resolveProductBookingUxMode,
  type ProductBookingUxMode,
} from "@/lib/products/resolveProductBookingUx";
import type { Product } from "@/types/product";

export type ProductBookingUxDiagnosis = {
  productId: string;
  title: string;
  bookingUxMode: ProductBookingUxMode;
  departureUi: "chips" | "calendar";
  showCalendarBooking: boolean;
  showDepositSection: boolean;
  hasBookingPanel: boolean;
  calendarDepartureCount: number;
  scheduleRowCount: number;
  legacyDepartureCount: number;
  hasDepartureRange: boolean;
  hasOptions: boolean;
  seasonalBandsPresent: boolean;
  isPromotionCampaign: boolean;
  uiExpectation: string;
};

export function diagnoseProductBookingUx(product: Product): ProductBookingUxDiagnosis {
  const bookingUxMode = resolveProductBookingUxMode(product);
  const departureUi = resolveDepartureUiForProduct(product);
  const showCalendarBooking = bookingUxMode === "calendar_booking";
  const calendarDepartureCount = collectProductDepartureDates(product).length;
  const scheduleRowCount = product.departureSchedules?.length ?? 0;
  const legacyDepartureCount = product.departures?.length ?? 0;
  const hasDepartureRange = Boolean(
    product.departure_from_date?.trim() || product.departure_to_date?.trim(),
  );
  const hasOptions =
    ENABLE_PRODUCT_OPTIONS &&
    Boolean(product.options?.groups != null && product.options.groups.length > 0);
  const hasLegacyDepartures = scheduleRowCount > 0 || legacyDepartureCount > 0;

  const hasBookingPanel =
    calendarDepartureCount > 0 || hasLegacyDepartures || hasOptions;

  const seasonalBandsPresent = Boolean(
    product.seasonal_price_bands &&
      (product.seasonal_price_bands.offSeason != null ||
        product.seasonal_price_bands.weekend != null ||
        product.seasonal_price_bands.peakSeason != null),
  );
  const isPromotionCampaign = productHasPromotionCampaignMeta(product);

  let uiExpectation: string;
  if (bookingUxMode === "seasonal_consult") {
    uiExpectation =
      "시즌 구간가 상품 — 달력·예약금 CTA 미노출(정상). Hero 구간가 + 상담 문의 이용.";
  } else if (bookingUxMode === "promotion_fixed") {
    uiExpectation =
      "특가/기획 상품 — 출발일 달력 UI. 예약금 CTA는 calendar_booking 전용이라 미노출(정상).";
  } else if (!hasBookingPanel) {
    uiExpectation =
      "일반 상품이지만 출발일·옵션 데이터 없음 — 예약 패널 전체 숨김. departure_schedules_json 또는 options 등록 필요.";
  } else if (calendarDepartureCount === 0 && hasOptions) {
    uiExpectation =
      "일반 상품 — 옵션만 노출, 달력 empty-state. 출발일 스케줄 등록 시 달력 dot 표시.";
  } else {
    uiExpectation =
      "일반 상품 — Summary 아래 달력 + (출발일 선택 후) 예약금 CTA. env 없어도 UI는 표시, 결제 클릭 시 PortOne 설정 필요.";
  }

  return {
    productId: product.id,
    title: product.title,
    bookingUxMode,
    departureUi,
    showCalendarBooking,
    showDepositSection: showCalendarBooking && hasBookingPanel,
    hasBookingPanel,
    calendarDepartureCount,
    scheduleRowCount,
    legacyDepartureCount,
    hasDepartureRange,
    hasOptions,
    seasonalBandsPresent,
    isPromotionCampaign,
    uiExpectation,
  };
}
