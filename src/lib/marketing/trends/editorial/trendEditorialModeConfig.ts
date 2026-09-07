/**
 * T-7 activation gate for trend-informed editorial planning.
 * Unset / blank / invalid => shadow (diagnostics only; production Agenda unchanged).
 */
export const MARKETING_TREND_EDITORIAL_MODE_ENV = "MARKETING_TREND_EDITORIAL_MODE" as const;

export const MARKETING_TREND_EDITORIAL_MODES = ["off", "shadow", "live"] as const;

export type MarketingTrendEditorialMode = (typeof MARKETING_TREND_EDITORIAL_MODES)[number];

export const DEFAULT_MARKETING_TREND_EDITORIAL_MODE: MarketingTrendEditorialMode = "shadow";

export function resolveMarketingTrendEditorialMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MarketingTrendEditorialMode {
  const raw = env[MARKETING_TREND_EDITORIAL_MODE_ENV];
  if (raw == null) return DEFAULT_MARKETING_TREND_EDITORIAL_MODE;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return DEFAULT_MARKETING_TREND_EDITORIAL_MODE;
  if ((MARKETING_TREND_EDITORIAL_MODES as readonly string[]).includes(normalized)) {
    return normalized as MarketingTrendEditorialMode;
  }
  return DEFAULT_MARKETING_TREND_EDITORIAL_MODE;
}
