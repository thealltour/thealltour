import { describe, expect, it } from "vitest";
import { createEmptyPlannerDraftInput, PLANNER_BUDGET_SLIDER_MAX } from "@/lib/planner/constants";
import {
  buildPlannerConstraintSemanticsSection,
  derivePlannerKnownConstraints,
  PLANNER_CONSTRAINT_SEMANTICS,
} from "@/lib/planner/constraintSemantics";
import { getPlannerDayMinimumItems, validatePlannerPlanQuality } from "@/lib/planner/planQuality";
import type { PlannerPlan, PlannerPlanItem } from "@/lib/planner/planSchemas";
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
    expect(rules).toContain("16:00~20:00는 정상적인 오후·초저녁 일정 시간대");
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

const AVOID_LATE_NIGHT_CHIP = "밤늦게까지 이어지는 일정은 피해주세요.";
const FREE_TIME_CHIP = "일정 중 자유시간을 충분히 확보해주세요.";

function canaryLikeDraft(overrides?: Partial<PlannerDraftInput>): PlannerDraftInput {
  return draft({
    travelers: { adults: 2, children: 1 },
    companionType: "family",
    interests: ["sightseeing", "food", "shopping"],
    pace: "balanced",
    additionalRequest: `너무 빡빡하지 않은 일정으로 해주세요. ${AVOID_LATE_NIGHT_CHIP} ${FREE_TIME_CHIP}`,
    ...overrides,
  });
}

describe("PR-9AE evening / free-time semantics", () => {
  const lateNight = PLANNER_CONSTRAINT_SEMANTICS.avoid_late_night.join("\n");
  const freeTime = PLANNER_CONSTRAINT_SEMANTICS.free_time.join("\n");

  it("A. treats 16~20h as normal afternoon/early-evening time, not late night", () => {
    expect(lateNight).toContain("16:00~20:00는 정상적인 오후·초저녁 일정 시간대");
    expect(lateNight).toContain("18:00~20:00 저녁 식사");
    expect(lateNight).toContain("17:00~20:30 쇼핑·야경·산책도 정상");
    expect(lateNight).toContain("오후 4시 이후를 late night로 보지 않습니다");
    expect(lateNight).toContain("『저녁 시간 비우기』도 아닙니다");
    expect(lateNight).toContain("15~16시의 휴식/자유시간으로 끝내지 않습니다");
  });

  it("B/C. keeps the 20:30 new-activity and 21:30 wrap-up guidelines", () => {
    expect(lateNight).toContain("일반 일정은 20:30 이후 새로 시작하지 않습니다.");
    expect(lateNight).toContain("주요 외부 일정은 가능하면 21:30 전후까지 마칩니다.");
  });

  it("D/E. free_time can be followed by dinner and is not a day-end signal", () => {
    expect(freeTime).toMatch(/60~120분/);
    expect(freeTime).toContain("하루 종료 신호가 아닙니다");
    expect(freeTime).toContain("자유시간 뒤에도 저녁 식사나 초저녁 활동을 이어갈 수 있습니다");
  });

  it("adds the avoid_late_night + free_time flow only when both chips are selected", () => {
    const both = buildPlannerConstraintSemanticsSection(canaryLikeDraft());
    expect(both).toContain("- avoid_late_night + free_time:");
    expect(both).toContain("자유시간 → 저녁 식사");
    expect(both).toContain("『점심 → 15:30 자유시간 → 하루 종료』로 해석하지 않습니다");

    const lateOnly = buildPlannerConstraintSemanticsSection(
      canaryLikeDraft({ additionalRequest: AVOID_LATE_NIGHT_CHIP }),
    );
    expect(lateOnly).not.toContain("avoid_late_night + free_time");
  });

  it("system prompt states evening interpretation for free-form requests too", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("16~20시는 정상적인 오후·초저녁 시간입니다");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("avoid_late_night ≠ 저녁 일정 삭제");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("free_time ≠ 하루 종료");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("일반 full day를 15~16시에 끝내지 마세요");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("카페 휴식 → 자유시간 → 숙소 휴식");
  });

  it("F. keeps the night_view + avoid_late_night conflict rule", () => {
    const section = buildPlannerConstraintSemanticsSection(
      canaryLikeDraft({ interests: ["night_view", "food"] }),
    );
    expect(section).toContain("night_view + avoid_late_night: 모순이 아닙니다");
    expect(section).toContain("18:30~20:30");
    expect(section).toContain("22:30 이후 새 activity 시작은 피합니다");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("5c. interests에 night_view");
  });

  it("G. keeps PR-9Z density targets and hard minimums unchanged", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("첫날·마지막 날: 이동 가능성을 고려해 2~3개");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("relaxed: 3~4");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("balanced: 4~5");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("packed: 5~6");
    const min = (dayIndex: number, pace: PlannerDraftInput["pace"]) =>
      getPlannerDayMinimumItems({ dayIndex, dayCount: 5, pace });
    expect([min(0, "balanced"), min(4, "balanced")]).toEqual([2, 2]);
    expect([min(2, "relaxed"), min(2, "balanced"), min(2, "packed")]).toEqual([2, 3, 4]);
  });

  it("H. dinner stays guidance only — no mandatory meal rule, dinner-less plan passes quality", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("필수 item은 아님");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("모든 끼니를 억지로 채우지는 마세요");
    const prompt = buildPlannerPlanUserPrompt(canaryLikeDraft());
    for (const text of [PLANNER_PLAN_SYSTEM_PROMPT, prompt]) {
      expect(text).not.toMatch(/저녁 식사(를|는)? 반드시/);
      expect(text).not.toMatch(/모든 (full )?day에 (저녁|dinner)/i);
    }

    const item = (order: number, time: string, type: PlannerPlanItem["type"]): PlannerPlanItem => ({
      order,
      time,
      type,
      name: `item-${order}`,
      area: null,
      description: "desc",
      estimatedDurationMinutes: 60,
      travelToNext: null,
      bookingRecommended: false,
    });
    const noDinnerDay = (day: number, count: number) => ({
      day,
      date: null,
      title: `Day ${day}`,
      summary: "summary",
      items: [
        item(1, "10:00", "attraction"),
        item(2, "12:00", "food"),
        item(3, "13:30", "shopping"),
        item(4, "15:00", "rest"),
      ].slice(0, count),
      tips: [],
    });
    const plan = {
      days: [noDinnerDay(1, 2), noDinnerDay(2, 3), noDinnerDay(3, 4), noDinnerDay(4, 3), noDinnerDay(5, 2)],
    } as unknown as PlannerPlan;
    expect(validatePlannerPlanQuality(plan, { pace: "balanced" })).toEqual({ ok: true });
  });

  it("regression fixture: canary-like balanced + late-night + free-time prompt carries all rules", () => {
    const prompt = buildPlannerPlanUserPrompt(canaryLikeDraft());
    expect(derivePlannerKnownConstraints(canaryLikeDraft().additionalRequest)).toEqual([
      "avoid_late_night",
      "free_time",
    ]);
    expect(prompt).toContain("[속도] ");
    expect(prompt).toContain("(balanced)");
    expect(prompt).toContain("[일정 제약 해석]");
    for (const rule of [
      "20:30 이후 새로 시작하지 않습니다",
      "21:30 전후까지 마칩니다",
      "16:00~20:00는 정상적인 오후·초저녁 일정 시간대",
      "『저녁 시간 비우기』도 아닙니다",
      "15~16시의 휴식/자유시간으로 끝내지 않습니다",
      "60~120분",
      "하루 종료 신호가 아닙니다",
      "avoid_late_night + free_time:",
    ]) {
      expect(prompt).toContain(rule);
    }
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
