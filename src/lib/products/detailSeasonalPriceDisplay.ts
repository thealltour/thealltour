import type { SeasonalPriceBands } from "@/types/product";

export type SeasonalPriceDisplayModel = {
  offSeason: number | null;
  weekend: number | null;
  peakSeason: number | null;
  minPrice: number | null;
  hasAny: boolean;
};

export type SeasonalHeroPriceLine = {
  prefix: string;
  amount: number;
};

function normalizeBandValue(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function getSeasonalPriceDisplayModel(
  bands?: SeasonalPriceBands | null,
): SeasonalPriceDisplayModel {
  const offSeason = normalizeBandValue(bands?.offSeason);
  const weekend = normalizeBandValue(bands?.weekend);
  const peakSeason = normalizeBandValue(bands?.peakSeason);
  const vals = [offSeason, weekend, peakSeason].filter((x): x is number => x != null);
  const minPrice = vals.length ? Math.min(...vals) : null;
  return {
    offSeason,
    weekend,
    peakSeason,
    minPrice,
    hasAny: vals.length > 0,
  };
}

/**
 * 상세 Hero 가격 카드: 구간이 1개뿐이면 "최저가 기준", 2개 이상이면 구간별 라벨.
 */
export function getSeasonalHeroPriceLines(model: SeasonalPriceDisplayModel): SeasonalHeroPriceLine[] {
  if (!model.hasAny) return [];
  const entries: SeasonalHeroPriceLine[] = [];
  if (model.offSeason != null) entries.push({ prefix: "비수기 기준", amount: model.offSeason });
  if (model.weekend != null) entries.push({ prefix: "주말 기준", amount: model.weekend });
  if (model.peakSeason != null) entries.push({ prefix: "성수기 기준", amount: model.peakSeason });
  if (entries.length === 1) {
    return [{ prefix: "최저가 기준", amount: entries[0].amount }];
  }
  return entries;
}

/** 상세 가격 카드 공통 안내 — compact (의미 유지, 밀도 축소) */
export const DETAIL_UNIFIED_PRICE_NOTICE_LINES = [
  "출발일·항공·시점에 따라 달라질 수 있어요. 최종 금액은 일정·인원 기준으로 안내됩니다.",
] as const;

/** @deprecated Prefer DETAIL_UNIFIED_PRICE_NOTICE_LINES (single compact line) */
export const DETAIL_PRICE_NOTICE_LEGACY_LINES = [
  "출발일, 항공 좌석 상황 및 예약 시점에 따라 가격이 변동될 수 있습니다.",
  "최종 금액은 일정과 인원 기준으로 안내되며, 포함사항·옵션은 상세 정보에서 확인할 수 있습니다.",
  "정확한 요금과 예약 가능 여부는 상담을 통해 안내드립니다.",
] as const;

/** Sticky·데스크톱 요약: 구간가 사용 시 변동성 힌트 (PR-E) */
export const STICKY_SEASONAL_VOLATILITY_HINT = "출발일별 가격 상이";
