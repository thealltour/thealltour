/**
 * Browser-only opaque Planner anonymous key.
 * Naming aligns with `theall_member_auth` cookie prefix.
 */
export const PLANNER_ANONYMOUS_KEY_STORAGE_KEY = "theall_planner_anonymous_key";

export function createPlannerAnonymousKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `planner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Read or create a stable key for this browser (localStorage). */
export function getOrCreatePlannerAnonymousKey(): string {
  if (typeof window === "undefined") {
    return createPlannerAnonymousKey();
  }
  try {
    const existing = window.localStorage.getItem(PLANNER_ANONYMOUS_KEY_STORAGE_KEY)?.trim();
    if (existing && existing.length >= 8) return existing;
    const next = createPlannerAnonymousKey();
    window.localStorage.setItem(PLANNER_ANONYMOUS_KEY_STORAGE_KEY, next);
    return next;
  } catch {
    return createPlannerAnonymousKey();
  }
}
