/**
 * Temporary client-only intent: user chose "login and continue" (ownership attach only).
 * Separate from saveIntent — must never trigger auto-save.
 * Does not store anonymousKey (reuse theall_planner_anonymous_key).
 */

export const PLANNER_CONTINUATION_INTENT_STORAGE_KEY = "theall_planner_continuation_intent";

/** 60 minutes */
export const PLANNER_CONTINUATION_INTENT_TTL_MS = 60 * 60 * 1000;

export type PlannerContinuationIntent = {
  sessionId: string;
  createdAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function setPlannerContinuationIntent(sessionId: string): void {
  if (!canUseStorage()) return;
  const id = sessionId.trim();
  if (!id) return;
  const payload: PlannerContinuationIntent = { sessionId: id, createdAt: Date.now() };
  try {
    window.sessionStorage.setItem(
      PLANNER_CONTINUATION_INTENT_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearPlannerContinuationIntent(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(PLANNER_CONTINUATION_INTENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readPlannerContinuationIntent(): PlannerContinuationIntent | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PLANNER_CONTINUATION_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerContinuationIntent>;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
      clearPlannerContinuationIntent();
      return null;
    }
    if (typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) {
      clearPlannerContinuationIntent();
      return null;
    }
    if (Date.now() - parsed.createdAt > PLANNER_CONTINUATION_INTENT_TTL_MS) {
      clearPlannerContinuationIntent();
      return null;
    }
    return { sessionId: parsed.sessionId.trim(), createdAt: parsed.createdAt };
  } catch {
    clearPlannerContinuationIntent();
    return null;
  }
}

/** Valid intent for this sessionId, else null. Does not clear on match. */
export function consumeMatchingPlannerContinuationIntent(
  sessionId: string,
): PlannerContinuationIntent | null {
  const intent = readPlannerContinuationIntent();
  if (!intent) return null;
  if (intent.sessionId !== sessionId.trim()) return null;
  return intent;
}
