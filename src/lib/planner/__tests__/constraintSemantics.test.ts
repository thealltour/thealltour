import { describe, expect, it } from "vitest";
import { createEmptyPlannerDraftInput, PLANNER_BUDGET_SLIDER_MAX } from "@/lib/planner/constants";
import {
  buildPlannerConstraintSemanticsSection,
  derivePlannerKnownConstraints,
  PLANNER_CONSTRAINT_SEMANTICS,
} from "@/lib/planner/constraintSemantics";
import { PLANNER_PLAN_SYSTEM_PROMPT, buildPlannerPlanUserPrompt } from "@/lib/planner/prompts";
import { plannerDraftInputSchema } from "@/lib/planner/schemas";
import type { PlannerDraftInput } from "@/types/planner";

function draft(overrides?: Partial<PlannerDraftInput>): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: ["food", "sightseeing"],
    pace: "balanced",
    budget: { style: "standard", amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
    ...overrides,
  };
}

describe("derivePlannerKnownConstraints", () => {
  it("detects known insertText chips only", () => {
    expect(
      derivePlannerKnownConstraints(
        "많이 걷지 않는 일정으로 구성해주세요. 밤늦게까지 이어지는 일정은 피해주세요.",
      ),
    ).toEqual(["less_walking", "avoid_late_night"]);
  });

  it("does not fuzzy-match free-form late-night wording", () => {
    expect(derivePlannerKnownConstraints("저녁 늦게는 싫어요")).toEqual([]);
  });

  it("leaves legacy free-form requests unrecognized", () => {
    expect(derivePlannerKnownConstraints("맛집 위주로 일정을 잡아주세요.")).toEqual([]);
  });
});

describe("constraint semantics content", () => {
  it("defines avoid_late_night numeric guidelines without 16:00 cutoff", () => {
    const rules = PLANNER_CONSTRAINT_SEMANTICS.avoid_late_night.join("\n");
    expect(rules).toContain("20:30");
    expect(rules).toContain("21:30");
    expect(rules).toContain("16~19시");
    expect(rules).toContain("16시 이후 일정 없음");
  });

  it("defines slow_morning 09:30 guideline", () => {
    expect(PLANNER_CONSTRAINT_SEMANTICS.slow_morning.join("\n")).toContain("09:30");
  });

  it("defines free_time 60~120 minute guideline", () => {
    expect(PLANNER_CONSTRAINT_SEMANTICS.free_time.join("\n")).toMatch(/60~120분/);
  });

  it("defines fewer_transitions as area clustering not item reduction", () => {
    const rules = PLANNER_CONSTRAINT_SEMANTICS.fewer_transitions.join("\n");
    expect(rules).toContain("1~2개");
    expect(rules).toContain("장소 2개만");
  });

  it("states less_walking is not an item-count reduction signal", () => {
    expect(PLANNER_CONSTRAINT_SEMANTICS.less_walking.join("\n")).toContain(
      "itinerary item 수를 무조건 줄이라는 뜻이 아닙니다",
    );
  });

  it("states less_transfer prefers clustering over item reduction", () => {
    expect(PLANNER_CONSTRAINT_SEMANTICS.less_transfer.join("\n")).toContain(
      "item 수 감소 신호로 해석하지 않습니다",
    );
  });
});

describe("buildPlannerConstraintSemanticsSection / user prompt", () => {
  it("adds canonical avoid_late_night rules to user prompt", () => {
    const prompt = buildPlannerPlanUserPrompt(
      draft({
        additionalRequest: "밤늦게까지 이어지는 일정은 피해주세요.",
      }),
    );
    expect(prompt).toContain("[추가 요청] 밤늦게까지 이어지는 일정은 피해주세요.");
    expect(prompt).toContain("[일정 제약 해석]");
    expect(prompt).toContain("20:30");
    expect(prompt).toContain("21:30");
    expect(prompt).toContain("16시 이후 일정 없음");
  });

  it("includes night_view + avoid_late_night conflict guidance", () => {
    const prompt = buildPlannerPlanUserPrompt(
      draft({
        interests: ["night_view", "food"],
        additionalRequest: "밤늦게까지 이어지는 일정은 피해주세요.",
      }),
    );
    expect(prompt).toContain("야경");
    expect(prompt).toContain("18:30~20:30");
    expect(prompt).toContain("22:30");
    expect(prompt).toContain("모순이 아닙니다");
  });

  it("includes slow_morning and free_time semantics when chips selected", () => {
    const prompt = buildPlannerPlanUserPrompt(
      draft({
        additionalRequest:
          "아침 일정은 너무 이르게 시작하지 않도록 구성해주세요. 일정 중 자유시간을 충분히 확보해주세요.",
      }),
    );
    expect(prompt).toContain("09:30");
    expect(prompt).toMatch(/60~120분/);
  });

  it("keeps legacy free-form text without inventing canonical constraints", () => {
    const section = buildPlannerConstraintSemanticsSection(
      draft({ additionalRequest: "맛집 위주로 일정을 잡아주세요." }),
    );
    expect(section).toBe("");
    const prompt = buildPlannerPlanUserPrompt(
      draft({ additionalRequest: "맛집 위주로 일정을 잡아주세요." }),
    );
    expect(prompt).toContain("[추가 요청] 맛집 위주로 일정을 잡아주세요.");
    expect(prompt).not.toContain("[일정 제약 해석]");
  });
});

describe("system prompt budget / conflict semantics", () => {
  it("includes budget style semantics and amount precedence", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("cost-conscious");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("mid-range balanced");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("comfort/experience weighted");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("amount)이 있으면 style보다");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("가짜 정밀 수치");
  });

  it("includes night_view conflict and overconstraint guards", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("night_view");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("22:30");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("avoid_late_night ≠ 16시 종료");
  });

  it("keeps PR-9Z density targets", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("relaxed: 3~4");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("balanced: 4~5");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("packed: 5~6");
  });
});

describe("budget slider / schema ceiling", () => {
  it("raises slider max to 50_000_000", () => {
    expect(PLANNER_BUDGET_SLIDER_MAX).toBe(50_000_000);
  });

  it("allows large custom amounts in draft schema without upper max", () => {
    for (const amount of [10_000_000, 20_000_000, 50_000_000, 80_000_000]) {
      const parsed = plannerDraftInputSchema.safeParse(
        draft({
          budget: { style: null, amount, scope: "total", currency: "KRW" },
          interests: ["food"],
        }),
      );
      expect(parsed.success).toBe(true);
    }
  });
});
