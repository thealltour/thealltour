import type { Product } from "@/types/product";

/** PR-F: 카드 전용 전환 신호 (DB/관리자 필드 없음, 상품 데이터에서 1개만 추론) */
export type ProductCardHighlightTag =
  | "best_choice"
  | "weekend_popular"
  | "value_offseason"
  | "fast_response"
  | "closing_soon";

export const PRODUCT_CARD_HIGHLIGHT_LABELS: Record<ProductCardHighlightTag, string> = {
  best_choice: "가장 많이 선택된",
  weekend_popular: "주말 출발 인기",
  value_offseason: "비수기 가성비",
  fast_response: "상담 많은 일정",
  closing_soon: "마감 임박",
};

const FAST_RESPONSE_MIN_CONSULTS = 4;
const VALUE_OFFSEASON_MIN_RATIO = 1.12;
const BEST_CHOICE_MIN_REVIEWS = 8;

/**
 * 우선순위 1개만 반환. 마감(SOLD_OUT) 등은 신호 없음.
 */
export function pickProductCardHighlightTag(product: Product): ProductCardHighlightTag | undefined {
  const status = product.status ?? "AVAILABLE";
  if (status === "SOLD_OUT") return undefined;
  if (status === "LIMITED") return "closing_soon";

  const consultN = product.trust?.recentConsultCount;
  if (typeof consultN === "number" && Number.isFinite(consultN) && consultN >= FAST_RESPONSE_MIN_CONSULTS) {
    return "fast_response";
  }

  const bands = product.seasonal_price_bands;
  if (bands) {
    const off =
      typeof bands.offSeason === "number" && Number.isFinite(bands.offSeason) && bands.offSeason > 0
        ? bands.offSeason
        : null;
    const peak =
      typeof bands.peakSeason === "number" && Number.isFinite(bands.peakSeason) && bands.peakSeason > 0
        ? bands.peakSeason
        : null;
    if (off && peak && peak / off >= VALUE_OFFSEASON_MIN_RATIO) {
      return "value_offseason";
    }
    if (typeof bands.weekend === "number" && Number.isFinite(bands.weekend) && bands.weekend > 0) {
      return "weekend_popular";
    }
  }

  if (product.is_popular) return "best_choice";
  const rc = product.trust?.reviewCount;
  if (typeof rc === "number" && Number.isFinite(rc) && rc >= BEST_CHOICE_MIN_REVIEWS) {
    return "best_choice";
  }

  return undefined;
}
