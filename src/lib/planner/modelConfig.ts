/**
 * Planner-only model IDs for generation / semantic retry.
 * Provider selection lives in `modelProvider.ts` (PLANNER_AI_PROVIDER); admin import
 * IMPORT_AI_* env does not affect Planner.
 */

export const DEFAULT_PLANNER_PRIMARY_MODEL = "gpt-6.1-sol";
export const DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL = "gpt-6.1-sol";

/** Used only when PLANNER_AI_PROVIDER=google and the configured model is not a Gemini ID. */
export const DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_PLANNER_GOOGLE_SEMANTIC_FALLBACK_MODEL = "gemini-3.1-flash-lite";

function readModelEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

export function getPlannerPrimaryModelId(): string {
  return readModelEnv("PLANNER_PRIMARY_MODEL") ?? DEFAULT_PLANNER_PRIMARY_MODEL;
}

export function getPlannerSemanticFallbackModelId(): string {
  return (
    readModelEnv("PLANNER_SEMANTIC_FALLBACK_MODEL") ??
    DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL
  );
}

/** Semantic attempt 1 → primary; attempt 2+ → semantic fallback. */
export function getPlannerModelIdForSemanticAttempt(attempt: number): string {
  return attempt <= 1
    ? getPlannerPrimaryModelId()
    : getPlannerSemanticFallbackModelId();
}
