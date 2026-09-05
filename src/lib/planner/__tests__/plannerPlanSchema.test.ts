import { describe, expect, it } from "vitest";
import {
  assertGeneratedPlanMatchesDraft,
  PlannerPlanInvariantError,
  addDaysToIsoDate,
  expectedTripDays,
  plannerPlanSchema,
} from "@/lib/planner/planSchemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PlannerDraftInput } from "@/types/planner";

function sampleDraft(): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카"),
    dates: {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      durationDays: 3,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: ["food", "sightseeing"],
    pace: "balanced",
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
  };
}

function samplePlan() {
  return {
    title: "오사카 2박 3일 미식·관광",
    summary: "난바와 도톤보리를 중심으로 여유롭게 즐기는 일정입니다.",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
      travelersSummary: "성인 2명",
      styleSummary: "맛집과 관광 중심",
    },
    days: [0, 1, 2].map((i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루 요약",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "가볍게 둘러보기",
          estimatedDurationMinutes: 90,
          travelToNext: { mode: "walk" as const, estimatedMinutes: 10 },
          bookingRecommended: false,
        },
      ],
      tips: ["방문 전 최신 운영시간을 확인해 주세요."],
    })),
    preparation: {
      travelTips: ["혼잡 시간대를 피하세요."],
      packingHints: ["편한 신발"],
    },
  };
}

describe("plannerPlanSchema", () => {
  it("accepts a valid plan", () => {
    const parsed = plannerPlanSchema.parse(samplePlan());
    expect(parsed.days).toHaveLength(3);
  });

  it("rejects invalid item type", () => {
    const plan = samplePlan();
    (plan.days[0]!.items[0] as { type: string }).type = "hotel";
    expect(plannerPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects negative duration", () => {
    const plan = samplePlan();
    plan.days[0]!.items[0]!.estimatedDurationMinutes = -5 as unknown as number;
    expect(plannerPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects non-sequential item order", () => {
    const plan = samplePlan();
    plan.days[0]!.items = [
      { ...plan.days[0]!.items[0]!, order: 1 },
      { ...plan.days[0]!.items[0]!, order: 3, name: "다음" },
    ];
    expect(plannerPlanSchema.safeParse(plan).success).toBe(false);
  });
});

describe("assertGeneratedPlanMatchesDraft", () => {
  it("passes when days and dates match", () => {
    expect(() => assertGeneratedPlanMatchesDraft(samplePlan(), sampleDraft())).not.toThrow();
  });

  it("rejects wrong day count", () => {
    const plan = samplePlan();
    plan.days = plan.days.slice(0, 2);
    plan.tripOverview.days = 2;
    plan.tripOverview.nights = 1;
    expect(() => assertGeneratedPlanMatchesDraft(plan, sampleDraft())).toThrow(
      PlannerPlanInvariantError,
    );
  });

  it("rejects date sequence mismatch", () => {
    const plan = samplePlan();
    plan.days[1]!.date = "2026-10-05";
    expect(() => assertGeneratedPlanMatchesDraft(plan, sampleDraft())).toThrow(
      PlannerPlanInvariantError,
    );
  });

  it("computes expected trip days", () => {
    expect(expectedTripDays("2026-10-01", "2026-10-03")).toBe(3);
  });
});

describe("generation analytics names", () => {
  it("registers PR-3 events", () => {
    expect(ANALYTICS_EVENTS.planner_generation_started).toBe("planner_generation_started");
    expect(ANALYTICS_EVENTS.planner_plan_generated).toBe("planner_plan_generated");
    expect(ANALYTICS_EVENTS.planner_generation_failed).toBe("planner_generation_failed");
  });
});
