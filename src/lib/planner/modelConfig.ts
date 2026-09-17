/**
 * Planner-only model IDs for generation / semantic retry.
 * Independent of admin import IMPORT_AI_MODEL / IMPORT_AI_FALLBACK_MODEL.
 */

export const DEFAULT_PLANNER_PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_PLANNER_SEMANTIC_FALLBACK_MODEL = "gemini-3.1-flash-lite";

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
