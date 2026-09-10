/** OBS-6 analytics time windows — allowlisted only. */

export const MARKETING_OBS_ANALYTICS_RANGES = ["24h", "7d", "30d"] as const;
export type MarketingObsAnalyticsRange = (typeof MARKETING_OBS_ANALYTICS_RANGES)[number];

export const DEFAULT_MARKETING_OBS_ANALYTICS_RANGE: MarketingObsAnalyticsRange = "7d";

export type MarketingObsAnalyticsWindow = {
  range: MarketingObsAnalyticsRange;
  /** Inclusive lower bound (UTC ISO). */
  startIso: string;
  /** Exclusive upper bound (UTC ISO). */
  endIso: string;
};

export function isMarketingObsAnalyticsRange(value: string): value is MarketingObsAnalyticsRange {
  return (MARKETING_OBS_ANALYTICS_RANGES as readonly string[]).includes(value);
}

/**
 * Rolling UTC windows from `now`.
 * Storage timestamps are UTC; UI may label in KST separately.
 */
export function resolveMarketingObsAnalyticsWindow(
  rangeInput: string | null | undefined,
  nowMs: number = Date.now(),
): MarketingObsAnalyticsWindow {
  const raw = (rangeInput ?? DEFAULT_MARKETING_OBS_ANALYTICS_RANGE).toLowerCase().trim();
  const range: MarketingObsAnalyticsRange = isMarketingObsAnalyticsRange(raw)
    ? raw
    : DEFAULT_MARKETING_OBS_ANALYTICS_RANGE;

  const ms =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  const end = nowMs;
  const start = end - ms;
  return {
    range,
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
  };
}
