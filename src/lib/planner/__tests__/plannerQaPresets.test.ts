import { describe, expect, it } from "vitest";
import {
  createFutureFixedDateRange,
  getPlannerQaPreset,
  getPlannerQaPresets,
  PLANNER_QA_PRESET_IDS,
} from "@/lib/planner/qaPresets";
import { canArriveAtPlannerStep } from "@/lib/planner/qaStepSafety";
import { computeDurationDays } from "@/lib/planner/dates";
import { plannerDraftInputSchema, validatePlannerStep } from "@/lib/planner/schemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { dateToYmd } from "@/lib/datePickerUtils";

describe("createFutureFixedDateRange", () => {
  it("builds future fixed dates with matching duration", () => {
    const now = new Date(2026, 8, 9); // local Sep 9 2026
    const range = createFutureFixedDateRange({
      startOffsetDays: 30,
      durationDays: 5,
      now,
    });
    expect(range.mode).toBe("fixed");
    expect(range.startDate > dateToYmd(now)).toBe(true);
    expect(computeDurationDays(range.startDate, range.endDate)).toBe(5);
    expect(range.durationDays).toBe(5);
  });
});

describe("planner QA presets", () => {
  it("exposes four presets", () => {
    expect(PLANNER_QA_PRESET_IDS).toHaveLength(4);
    expect(getPlannerQaPresets().map((p) => p.id)).toEqual(PLANNER_QA_PRESET_IDS);
  });

  it.each(PLANNER_QA_PRESET_IDS)("%s passes plannerDraftInputSchema", (id) => {
    const preset = getPlannerQaPreset(id, new Date(2026, 8, 9));
    expect(plannerDraftInputSchema.safeParse(preset.draft).success).toBe(true);
  });

  it.each(PLANNER_QA_PRESET_IDS)("%s passes validatePlannerStep 1..7", (id) => {
    const draft = getPlannerQaPreset(id, new Date(2026, 8, 9)).draft;
    for (let step = 1; step <= 7; step++) {
      expect(validatePlannerStep(step, draft)).toBeNull();
    }
  });

  it("tokyo-flexible has null calendar dates", () => {
    const draft = getPlannerQaPreset("tokyo-flexible").draft;
    expect(draft.dates.mode).toBe("flexible");
    expect(draft.dates.startDate).toBeNull();
    expect(draft.dates.endDate).toBeNull();
    expect(draft.dates.durationDays).toBeGreaterThanOrEqual(2);
  });

  it("osaka-fixed uses future dates", () => {
    const now = new Date(2026, 8, 9);
    const draft = getPlannerQaPreset("osaka-fixed", now).draft;
    expect(draft.dates.mode).toBe("fixed");
    expect(draft.dates.startDate! > dateToYmd(now)).toBe(true);
    expect(draft.interests.length).toBeGreaterThanOrEqual(1);
  });
});

describe("canArriveAtPlannerStep", () => {
  it("allows step 1 always", () => {
    expect(canArriveAtPlannerStep(createEmptyPlannerDraftInput(), 1)).toBe(true);
  });

  it("blocks jump to 4 when prior steps incomplete", () => {
    expect(canArriveAtPlannerStep(createEmptyPlannerDraftInput(), 4)).toBe(false);
  });

  it("allows jump to 4/7 with valid preset", () => {
    const draft = getPlannerQaPreset("minimal-valid", new Date(2026, 8, 9)).draft;
    expect(canArriveAtPlannerStep(draft, 4)).toBe(true);
    expect(canArriveAtPlannerStep(draft, 7)).toBe(true);
  });
});
