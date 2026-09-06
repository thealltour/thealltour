/**
 * STEP E-4H: explicit safe activation gate for Agenda semantic soft demotion.
 * Unset / blank / invalid => shadow (compute diagnostics, do not mutate ranking).
 */
export const MARKETING_SEMANTIC_DEMOTION_MODE_ENV = "MARKETING_SEMANTIC_DEMOTION_MODE" as const;

export const MARKETING_SEMANTIC_DEMOTION_MODES = ["off", "shadow", "live"] as const;

export type MarketingSemanticDemotionMode = (typeof MARKETING_SEMANTIC_DEMOTION_MODES)[number];

/** Safe default — never silently change production ranking. */
export const DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE: MarketingSemanticDemotionMode = "shadow";

export function resolveMarketingSemanticDemotionMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MarketingSemanticDemotionMode {
  const raw = env[MARKETING_SEMANTIC_DEMOTION_MODE_ENV];
  if (raw == null) return DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE;
  if ((MARKETING_SEMANTIC_DEMOTION_MODES as readonly string[]).includes(normalized)) {
    return normalized as MarketingSemanticDemotionMode;
  }
  return DEFAULT_MARKETING_SEMANTIC_DEMOTION_MODE;
}
