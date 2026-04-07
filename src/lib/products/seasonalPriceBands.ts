import type { SeasonalPriceBands } from "@/types/product";

/** PostgreSQL integer 호환 (serializer와 동일 상한) */
function toSafePositiveInteger(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const int = Math.round(value);
  if (int <= 0) return null;
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

/**
 * 폼/임의 입력 → 양의 정수 또는 null.
 * 빈 문자열·0·음수·NaN → null
 */
export function normalizeNullablePriceNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return toSafePositiveInteger(value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/~/g, "").replace(/\s/g, "").trim();
    if (!normalized) return null;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return toSafePositiveInteger(n);
  }
  return null;
}

/**
 * DB/API jsonb·객체에서 SeasonalPriceBands 복원.
 * camelCase 및 snake_case 키 허용.
 */
export function parseSeasonalPriceBandsFromUnknown(raw: unknown): SeasonalPriceBands | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      return parseSeasonalPriceBandsFromUnknown(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const offSeason =
    normalizeNullablePriceNumber(o.offSeason ?? o.off_season ?? o.offseason) ?? null;
  const weekend = normalizeNullablePriceNumber(o.weekend) ?? null;
  const peakSeason =
    normalizeNullablePriceNumber(o.peakSeason ?? o.peak_season ?? o.peakseason) ?? null;
  if (offSeason == null && weekend == null && peakSeason == null) return null;
  const out: SeasonalPriceBands = {};
  if (offSeason != null) out.offSeason = offSeason;
  if (weekend != null) out.weekend = weekend;
  if (peakSeason != null) out.peakSeason = peakSeason;
  return Object.keys(out).length > 0 ? out : null;
}

export type SeasonalPriceBandFormStrings = {
  offSeason: string;
  weekend: string;
  peakSeason: string;
};

/** 관리자 폼 문자열 → 저장 가능한 밴드 (전부 비면 null) */
export function sanitizeSeasonalPriceBandsFromFormStrings(
  bands: SeasonalPriceBandFormStrings,
): SeasonalPriceBands | null {
  const offSeason = normalizeNullablePriceNumber(bands.offSeason) ?? null;
  const weekend = normalizeNullablePriceNumber(bands.weekend) ?? null;
  const peakSeason = normalizeNullablePriceNumber(bands.peakSeason) ?? null;
  if (offSeason == null && weekend == null && peakSeason == null) return null;
  const out: SeasonalPriceBands = {};
  if (offSeason != null) out.offSeason = offSeason;
  if (weekend != null) out.weekend = weekend;
  if (peakSeason != null) out.peakSeason = peakSeason;
  return Object.keys(out).length > 0 ? out : null;
}

/** jsonb 저장용: 값이 있는 키만 포함 (또는 전부 없으면 null) */
export function seasonalPriceBandsToJsonColumn(
  bands: SeasonalPriceBands | null,
): Record<string, number> | null {
  if (!bands) return null;
  const out: Record<string, number> = {};
  if (bands.offSeason != null && bands.offSeason > 0) out.offSeason = bands.offSeason;
  if (bands.weekend != null && bands.weekend > 0) out.weekend = bands.weekend;
  if (bands.peakSeason != null && bands.peakSeason > 0) out.peakSeason = bands.peakSeason;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * 대표가(price) 자동 보정 후보: 유효 밴드 중 최소값.
 * 없으면 null.
 */
export function getFallbackBasePriceFromSeasonalBands(
  bands?: SeasonalPriceBands | null,
): number | null {
  if (!bands) return null;
  const vals = [bands.offSeason, bands.weekend, bands.peakSeason].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (vals.length === 0) return null;
  return Math.min(...vals);
}
