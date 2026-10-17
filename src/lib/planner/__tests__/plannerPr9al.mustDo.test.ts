import { describe, expect, it } from "vitest";
import { createEmptyPlannerDraftInput, PLANNER_WIZARD_STEP_COUNT } from "@/lib/planner/constants";
import {
  countPlannerMustDoCoverage,
  parsePlannerMustDoText,
} from "@/lib/planner/mustDo";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import { buildPlannerEditUserPrompt, buildPlannerPlanUserPrompt } from "@/lib/planner/prompts";
import {
  plannerDraftInputProgressSchema,
  plannerDraftInputSchema,
  updatePlannerSessionBodySchema,
  validatePlannerStep,
} from "@/lib/planner/schemas";
import type { PlannerDraftInput } from "@/types/planner";

function completeDraft(overrides: Partial<PlannerDraftInput> = {}): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: { mode: "flexible", startDate: null, endDate: null, durationDays: 3 },
    interests: ["food"],
    ...overrides,
  };
}

/** Pre-PR-9AL input_json shape (no mustDo key). */
function legacyInputJson(): Record<string, unknown> {
  const { mustDo: _omit, ...rest } = completeDraft();
  void _omit;
  return rest;
}

function samplePlan(): PlannerPlan {
  return plannerPlanSchema.parse({
    title: "오사카 1일 여행",
    summary: "오사카 핵심 일정",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: null,
      endDate: null,
      nights: 0,
      days: 1,
      travelersSummary: "성인 2명",
      styleSummary: "맛집 위주",
    },
    days: [
      {
        day: 1,
        date: null,
        title: "오사카 첫날",
        summary: "도착 후 가볍게",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "오사카성",
            area: "주오구",
            description: "천수각 관람",
            estimatedDurationMinutes: 90,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["교통패스 확인"], packingHints: ["편한 신발"] },
  });
}

const item = (n: number) => `장소${n}`;

describe("PR-9AL mustDo — empty draft (A)", () => {
  it("createEmptyPlannerDraftInput has mustDo []", () => {
    expect(createEmptyPlannerDraftInput().mustDo).toEqual([]);
  });

  it("keeps the 7-step wizard", () => {
    expect(PLANNER_WIZARD_STEP_COUNT).toBe(7);
  });
});

describe("PR-9AL mustDo — schema (B)", () => {
  const schemas = [
    ["input", plannerDraftInputSchema],
    ["progress", plannerDraftInputProgressSchema],
  ] as const;

  describe.each(schemas)("%s schema", (_name, schema) => {
    const parse = (mustDo: unknown) => schema.safeParse({ ...completeDraft(), mustDo });

    it("accepts []", () => {
      expect(parse([]).success).toBe(true);
    });

    it('accepts ["USJ"]', () => {
      const parsed = parse(["USJ"]);
      expect(parsed.success && parsed.data.mustDo).toEqual(["USJ"]);
    });

    it("accepts 5 items", () => {
      expect(parse([1, 2, 3, 4, 5].map(item)).success).toBe(true);
    });

    it("rejects 6 items", () => {
      expect(parse([1, 2, 3, 4, 5, 6].map(item)).success).toBe(false);
    });

    it("accepts an 80-char item and rejects 81 chars", () => {
      expect(parse(["가".repeat(80)]).success).toBe(true);
      expect(parse(["가".repeat(81)]).success).toBe(false);
    });

    it("rejects blank items and non-string items", () => {
      expect(parse(["   "]).success).toBe(false);
      expect(parse([1]).success).toBe(false);
    });

    it("trims and de-duplicates", () => {
      const parsed = parse([" USJ ", "USJ", "오사카성"]);
      expect(parsed.success && parsed.data.mustDo).toEqual(["USJ", "오사카성"]);
    });

    it("defaults missing mustDo to [] (legacy clients)", () => {
      const parsed = schema.safeParse(legacyInputJson());
      expect(parsed.success && parsed.data.mustDo).toEqual([]);
    });
  });

  it("PATCH body rejects 6 items instead of silently truncating", () => {
    const parsed = updatePlannerSessionBodySchema.safeParse({
      anonymousKey: "anon-pr9al-test-key-01",
      input: { ...completeDraft(), mustDo: [1, 2, 3, 4, 5, 6].map(item) },
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps themeRequest / additionalRequest validation", () => {
    expect(
      plannerDraftInputSchema.safeParse(completeDraft({ themeRequest: "가".repeat(1001) })).success,
    ).toBe(false);
    expect(
      plannerDraftInputSchema.safeParse(completeDraft({ additionalRequest: "가".repeat(1001) }))
        .success,
    ).toBe(false);
  });
});

describe("PR-9AL mustDo — normalizer (C, D, E, L)", () => {
  it("restores legacy input_json without mustDo as []", () => {
    const restored = normalizePlannerDraftInput(legacyInputJson());
    expect(restored.mustDo).toEqual([]);
    expect(restored.destination.text).toBe("오사카");
    expect(plannerDraftInputSchema.safeParse(restored).success).toBe(true);
  });

  it("round-trips mustDo", () => {
    const saved = JSON.parse(JSON.stringify(completeDraft({ mustDo: ["USJ", "오사카성"] })));
    expect(normalizePlannerDraftInput(saved).mustDo).toEqual(["USJ", "오사카성"]);
  });

  it("trims and de-duplicates", () => {
    const restored = normalizePlannerDraftInput({
      ...completeDraft(),
      mustDo: [" USJ ", "USJ", "오사카성"],
    });
    expect(restored.mustDo).toEqual(["USJ", "오사카성"]);
  });

  it("defensively repairs malformed stored values", () => {
    expect(normalizePlannerDraftInput({ ...completeDraft(), mustDo: "USJ" }).mustDo).toEqual([]);
    expect(
      normalizePlannerDraftInput({ ...completeDraft(), mustDo: [1, null, " ", "온천"] }).mustDo,
    ).toEqual(["온천"]);
    expect(
      normalizePlannerDraftInput({ ...completeDraft(), mustDo: ["가".repeat(81), "USJ"] }).mustDo,
    ).toEqual(["USJ"]);
    const restored = normalizePlannerDraftInput({
      ...completeDraft(),
      mustDo: [1, 2, 3, 4, 5, 6, 7].map(item),
    });
    expect(restored.mustDo).toEqual([1, 2, 3, 4, 5].map(item));
    expect(plannerDraftInputSchema.safeParse(restored).success).toBe(true);
  });

  it("leaves saved plan schema unchanged (strict parse of existing plan_json)", () => {
    const plan = samplePlan();
    expect(plannerPlanSchema.safeParse(JSON.parse(JSON.stringify(plan))).success).toBe(true);
    const withExtra = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        items: d.items.map((i) => ({ ...i, mustDo: true })),
      })),
    };
    expect(plannerPlanSchema.safeParse(withExtra).success).toBe(false);
  });
});

describe("PR-9AL mustDo — step validation (F)", () => {
  it("step 4 passes with mustDo []", () => {
    expect(validatePlannerStep(4, completeDraft({ mustDo: [] }))).toBeNull();
  });

  it("step 4 passes with up to 5 items", () => {
    expect(validatePlannerStep(4, completeDraft({ mustDo: [1, 2, 3, 4, 5].map(item) }))).toBeNull();
  });

  it("step 4 reports 6 items and 81-char items", () => {
    expect(
      validatePlannerStep(4, completeDraft({ mustDo: [1, 2, 3, 4, 5, 6].map(item) })),
    ).toMatch(/5개/);
    expect(validatePlannerStep(4, completeDraft({ mustDo: ["가".repeat(81)] }))).toMatch(/80자/);
  });
});

describe("PR-9AL mustDo — text parsing (G)", () => {
  it("splits on comma and newline", () => {
    expect(parsePlannerMustDoText("USJ, 오사카성\n온천")).toEqual(["USJ", "오사카성", "온천"]);
  });

  it("drops empty segments and duplicates", () => {
    expect(parsePlannerMustDoText(" USJ ,, \nUSJ\n")).toEqual(["USJ"]);
    expect(parsePlannerMustDoText("")).toEqual([]);
  });
});

describe("PR-9AL mustDo — generation prompt (I, J)", () => {
  it("adds the mustDo SSOT line", () => {
    const prompt = buildPlannerPlanUserPrompt(completeDraft({ mustDo: ["USJ", "오사카성"] }));
    expect(prompt).toContain("[꼭 방문/체험] USJ | 오사카성");
    expect(prompt.indexOf("[여행 분위기]")).toBeLessThan(prompt.indexOf("[꼭 방문/체험]"));
    expect(prompt.indexOf("[꼭 방문/체험]")).toBeLessThan(prompt.indexOf("[속도]"));
  });

  it("does not merge mustDo into themeRequest / additionalRequest", () => {
    const prompt = buildPlannerPlanUserPrompt(completeDraft({ mustDo: ["USJ"] }));
    expect(prompt).toContain("[여행 분위기] 없음");
    expect(prompt).toContain("[추가 요청] 없음");
  });

  it("prints 없음 when empty", () => {
    expect(buildPlannerPlanUserPrompt(completeDraft())).toContain("[꼭 방문/체험] 없음");
  });
});

describe("PR-9AL mustDo — edit prompt (K)", () => {
  it("passes the original mustDo as context", () => {
    const prompt = buildPlannerEditUserPrompt({
      draft: completeDraft({ mustDo: ["USJ", "오사카성"] }),
      currentPlan: samplePlan(),
      instruction: "둘째 날을 여유롭게",
    });
    expect(prompt).toContain("[사용자 지정 방문/체험]\n- USJ\n- 오사카성");
  });

  it("prints 없음 when empty", () => {
    const prompt = buildPlannerEditUserPrompt({
      draft: completeDraft(),
      currentPlan: samplePlan(),
      instruction: "둘째 날을 여유롭게",
    });
    expect(prompt).toContain("[사용자 지정 방문/체험]\n없음");
  });
});

describe("PR-9AL mustDo — coverage diagnostic", () => {
  it("counts matched/unmatched by normalized name inclusion", () => {
    expect(
      countPlannerMustDoCoverage(["오사카성", "USJ"], ["오사카성 천수각", "도톤보리"]),
    ).toEqual({ matchedCount: 1, unmatchedCount: 1 });
  });
});
