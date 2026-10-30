/**
 * Client-only: guest hit lifetime quota → Kakao login → resume draft session.
 * Does not store anonymousKey (reuse theall_planner_anonymous_key).
 */

export const PLANNER_GENERATION_INTENT_STORAGE_KEY = "theall_planner_generation_intent";

/** 60 minutes */
export const PLANNER_GENERATION_INTENT_TTL_MS = 60 * 60 * 1000;

export type PlannerGenerationIntent = {
  sessionId: string;
  createdAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function setPlannerGenerationIntent(sessionId: string): void {
  if (!canUseStorage()) return;
  const id = sessionId.trim();
  if (!id) return;
  const payload: PlannerGenerationIntent = { sessionId: id, createdAt: Date.now() };
  try {
    window.sessionStorage.setItem(
      PLANNER_GENERATION_INTENT_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // ignore
  }
}

export function clearPlannerGenerationIntent(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(PLANNER_GENERATION_INTENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readPlannerGenerationIntent(): PlannerGenerationIntent | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PLANNER_GENERATION_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerGenerationIntent>;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
      clearPlannerGenerationIntent();
      return null;
    }
    if (typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) {
      clearPlannerGenerationIntent();
      return null;
    }
    if (Date.now() - parsed.createdAt > PLANNER_GENERATION_INTENT_TTL_MS) {
      clearPlannerGenerationIntent();
      return null;
    }
    return { sessionId: parsed.sessionId.trim(), createdAt: parsed.createdAt };
  } catch {
    clearPlannerGenerationIntent();
    return null;
  }
}

export function consumeMatchingPlannerGenerationIntent(
  sessionId: string,
): PlannerGenerationIntent | null {
  const intent = readPlannerGenerationIntent();
  if (!intent) return null;
  if (intent.sessionId !== sessionId.trim()) return null;
  clearPlannerGenerationIntent();
  return intent;
}
