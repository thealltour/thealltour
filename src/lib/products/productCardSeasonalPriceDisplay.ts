import type { SeasonalPriceBands } from "@/types/product";
import { formatPriceKR } from "@/lib/pricing/calcQuote";

export type ProductCardSeasonalBandInfo = {
  min: number;
  hasOffSeason: boolean;
};

function formatDigits(n: number): string {
  return formatPriceKR(n) ?? new Intl.NumberFormat("ko-KR").format(n);
}

/** 유효한 구간가가 하나라도 있으면 min·비수기 여부 */
export function getProductCardSeasonalBandInfo(
  bands: SeasonalPriceBands | null | undefined,
): ProductCardSeasonalBandInfo | null {
  if (!bands) return null;
  const vals = [bands.offSeason, bands.weekend, bands.peakSeason].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (vals.length === 0) return null;
  const min = Math.min(...vals);
  const hasOffSeason =
    typeof bands.offSeason === "number" && Number.isFinite(bands.offSeason) && bands.offSeason > 0;
  return { min, hasOffSeason };
}

/** grid / list: 메인 1줄 (항상 ~ 포함). 표시 금액은 비수기 우선, 없으면 구간 최저. */
export function getSeasonalCardMainLineFull(bands: SeasonalPriceBands, info: ProductCardSeasonalBandInfo): string {
  const n = info.hasOffSeason ? bands.offSeason! : info.min;
  const d = formatDigits(n);
  return `최저 ₩${d}~`;
}

export const SEASONAL_CARD_SUBLINE = "주말·성수기 별도";

/** related / stack: 최저가 숫자부만 (접두/접미는 카드에서 기존 규칙대로) */
export function getSeasonalCardCompactAmountDigits(info: ProductCardSeasonalBandInfo): string {
  return formatDigits(info.min);
}
