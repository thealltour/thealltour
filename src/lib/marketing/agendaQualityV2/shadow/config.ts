/**
 * AGENDA_QUALITY_V2 Live Shadow configuration.
 * Default OFF — V1 remains sole production Slate authority.
 */

export const AGENDA_QUALITY_V2_SHADOW_ENV_KEY = "AGENDA_QUALITY_V2_SHADOW_ENABLED" as const;
export const AGENDA_QUALITY_V2_MAX_TRANSFORMS_ENV_KEY =
  "AGENDA_QUALITY_V2_MAX_TRANSFORMS_PER_RUN" as const;
/** Optional local-only JSON reservoir when Supabase migration not yet applied. */
export const AGENDA_QUALITY_V2_SHADOW_JSON_FALLBACK_ENV_KEY =
  "AGENDA_QUALITY_V2_SHADOW_JSON_FALLBACK" as const;

export const AGENDA_QUALITY_V2_TRANSFORM_REVISION = "agenda-transform-v2.1" as const;
export const AGENDA_QUALITY_V2_PROMPT_VERSION = "agenda-transform-prompt-v2.1" as const;
export const AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION =
  "travel-marketing-editorial-v2" as const;
/** Historical prompts — ineligible for new validation carryover. */
export const AGENDA_QUALITY_V2_PROMPT_VERSION_V1 = "agenda-transform-prompt-v1" as const;
export const AGENDA_QUALITY_V2_PROMPT_VERSION_V2 = "agenda-transform-prompt-v2" as const;
export const AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1 = "agenda-transform-v1" as const;
export const AGENDA_QUALITY_V2_TRANSFORM_REVISION_V2 = "agenda-transform-v2" as const;

/** Safe default: covers typical V1 slate (≤8) + small research headroom. */
export const AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT = 12;

export const AGENDA_QUALITY_V2_ARTIFACT_ROOT = "artifacts/agenda-quality-v2" as const;
export const AGENDA_QUALITY_V2_LIVE_SHADOW_DIR = "artifacts/agenda-quality-v2/live-shadow" as const;

export function isAgendaQualityV2ShadowEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = (env[AGENDA_QUALITY_V2_SHADOW_ENV_KEY] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function resolveAgendaQualityV2MaxTransforms(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): number {
  const raw = (env[AGENDA_QUALITY_V2_MAX_TRANSFORMS_ENV_KEY] ?? "").trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0 && n <= 40) return Math.floor(n);
  return AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT;
}

export function isAgendaQualityV2JsonFallbackEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = (env[AGENDA_QUALITY_V2_SHADOW_JSON_FALLBACK_ENV_KEY] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Canonical artifact root under thealltour (NOT theallcloud / theallview typo paths).
 * Phase 3 RETURN text once said "theallview" by mistake; on-disk artifacts were always under cwd=thealltour.
 */
export function resolveAgendaQualityV2ArtifactRoot(cwd: string = process.cwd()): string {
  return `${cwd}/${AGENDA_QUALITY_V2_ARTIFACT_ROOT}`;
}

export function resolveAgendaQualityV2LiveShadowDir(cwd: string = process.cwd()): string {
  return `${cwd}/${AGENDA_QUALITY_V2_LIVE_SHADOW_DIR}`;
}
