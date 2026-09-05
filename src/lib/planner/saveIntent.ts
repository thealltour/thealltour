/**
 * Temporary client-only intent: user explicitly clicked Save before Kakao OAuth.
 * Does not store anonymousKey (reuse theall_planner_anonymous_key).
 */

export const PLANNER_SAVE_INTENT_STORAGE_KEY = "theall_planner_save_intent";

/** 60 minutes */
export const PLANNER_SAVE_INTENT_TTL_MS = 60 * 60 * 1000;

export type PlannerSaveIntent = {
  sessionId: string;
  createdAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function setPlannerSaveIntent(sessionId: string): void {
  if (!canUseStorage()) return;
  const id = sessionId.trim();
  if (!id) return;
  const payload: PlannerSaveIntent = { sessionId: id, createdAt: Date.now() };
  try {
    window.sessionStorage.setItem(PLANNER_SAVE_INTENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearPlannerSaveIntent(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(PLANNER_SAVE_INTENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readPlannerSaveIntent(): PlannerSaveIntent | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PLANNER_SAVE_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerSaveIntent>;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
      clearPlannerSaveIntent();
      return null;
    }
    if (typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) {
      clearPlannerSaveIntent();
      return null;
    }
    if (Date.now() - parsed.createdAt > PLANNER_SAVE_INTENT_TTL_MS) {
      clearPlannerSaveIntent();
      return null;
    }
    return { sessionId: parsed.sessionId.trim(), createdAt: parsed.createdAt };
  } catch {
    clearPlannerSaveIntent();
    return null;
  }
}

/** Valid intent for this sessionId, else null (and clear if expired/mismatch optional). */
export function consumeMatchingPlannerSaveIntent(sessionId: string): PlannerSaveIntent | null {
  const intent = readPlannerSaveIntent();
  if (!intent) return null;
  if (intent.sessionId !== sessionId.trim()) return null;
  return intent;
}
