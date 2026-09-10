/** Pure percentile helpers for OBS-6 duration metrics. */

export function percentileSorted(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const clamped = Math.min(100, Math.max(0, p));
  const idx = (clamped / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const w = idx - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

export function medianMs(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return percentileSorted(sorted, 50);
}

export function p95Ms(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return percentileSorted(sorted, 95);
}

/** Below this sample size, UI should prefer N/A / 데이터 부족 over strong claims. */
export const ANALYTICS_INSUFFICIENT_SAMPLE = 3;

export type SampledRate = {
  rate: number | null;
  numerator: number;
  denominator: number;
  sampleSize: number;
  insufficient: boolean;
};

export function sampledRate(numerator: number, denominator: number): SampledRate {
  if (denominator <= 0) {
    return { rate: null, numerator: 0, denominator: 0, sampleSize: 0, insufficient: true };
  }
  return {
    rate: numerator / denominator,
    numerator,
    denominator,
    sampleSize: denominator,
    insufficient: denominator < ANALYTICS_INSUFFICIENT_SAMPLE,
  };
}

export type SampledDuration = {
  medianMs: number | null;
  p95Ms: number | null;
  sampleSize: number;
  insufficient: boolean;
};

export function sampledDuration(values: number[]): SampledDuration {
  const clean = values.filter((n) => Number.isFinite(n) && n >= 0);
  return {
    medianMs: medianMs(clean),
    p95Ms: p95Ms(clean),
    sampleSize: clean.length,
    insufficient: clean.length < ANALYTICS_INSUFFICIENT_SAMPLE,
  };
}
