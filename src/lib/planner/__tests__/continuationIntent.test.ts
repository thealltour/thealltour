import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLANNER_CONTINUATION_INTENT_STORAGE_KEY,
  clearPlannerContinuationIntent,
  consumeMatchingPlannerContinuationIntent,
  readPlannerContinuationIntent,
  setPlannerContinuationIntent,
} from "@/lib/planner/continuationIntent";
import {
  PLANNER_SAVE_INTENT_STORAGE_KEY,
  setPlannerSaveIntent,
  readPlannerSaveIntent,
} from "@/lib/planner/saveIntent";

describe("continuationIntent", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("stores and matches sessionId separately from saveIntent", () => {
    setPlannerContinuationIntent("sess-1");
    setPlannerSaveIntent("sess-save");
    expect(readPlannerContinuationIntent()?.sessionId).toBe("sess-1");
    expect(readPlannerSaveIntent()?.sessionId).toBe("sess-save");
    expect(sessionStorage.getItem(PLANNER_CONTINUATION_INTENT_STORAGE_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(PLANNER_SAVE_INTENT_STORAGE_KEY)).toBeTruthy();
    expect(consumeMatchingPlannerContinuationIntent("sess-1")?.sessionId).toBe("sess-1");
    expect(consumeMatchingPlannerContinuationIntent("other")).toBeNull();
  });

  it("expires after TTL", () => {
    setPlannerContinuationIntent("sess-1");
    vi.setSystemTime(new Date("2026-10-31T02:00:00.000Z"));
    expect(readPlannerContinuationIntent()).toBeNull();
    clearPlannerContinuationIntent();
  });
});
