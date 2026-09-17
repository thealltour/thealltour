import { describe, expect, it } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { addDaysToIsoDate, plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import {
  getPlannerDayMinimumItems,
  getPlannerDayRole,
  getPlannerItemDensityStats,
  validatePlannerPlanQuality,
} from "@/lib/planner/planQuality";
import type { PlannerDraftInput, PlannerPace } from "@/types/planner";

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
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
    ...overrides,
  };
}

function item(order: number, type: PlannerPlan["days"][number]["items"][number]["type"] = "attraction") {
  return {
    order,
    time: "10:00",
    type,
    name: `장소 ${order}`,
    area: "난바",
    description: "일정 설명",
    estimatedDurationMinutes: 60,
    travelToNext: null,
    bookingRecommended: false,
  };
}

function planWithCounts(
  counts: number[],
  options?: { startDate?: string },
): PlannerPlan {
  const start = options?.startDate ?? "2026-10-01";
  const days = counts.length;
  return {
    title: `오사카 ${days}일`,
    summary: "밀도 테스트 일정",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: start,
      endDate: addDaysToIsoDate(start, days - 1),
      nights: Math.max(0, days - 1),
      days,
      travelersSummary: "성인 2명",
      styleSummary: "테스트",
    },
    days: counts.map((count, i) => ({
      day: i + 1,
      date: addDaysToIsoDate(start, i),
      title: `${i + 1}일차`,
      summary: "하루 요약",
      items: Array.from({ length: count }, (_, j) => item(j + 1, j % 2 === 1 ? "food" : "attraction")),
      tips: ["운영시간 확인"],
    })),
    preparation: {
      travelTips: ["혼잡 피하기"],
      packingHints: ["편한 신발"],
    },
  };
}

describe("getPlannerDayRole / getPlannerDayMinimumItems", () => {
  it("classifies one-day, arrival, full, departure", () => {
    expect(getPlannerDayRole(0, 1)).toBe("one_day");
    expect(getPlannerDayRole(0, 5)).toBe("arrival");
    expect(getPlannerDayRole(2, 5)).toBe("full");
    expect(getPlannerDayRole(4, 5)).toBe("departure");
  });

  it("applies hard minimums by pace and role", () => {
    expect(getPlannerDayMinimumItems({ dayIndex: 0, dayCount: 1, pace: "balanced" })).toBe(2);
    expect(getPlannerDayMinimumItems({ dayIndex: 0, dayCount: 5, pace: "balanced" })).toBe(2);
    expect(getPlannerDayMinimumItems({ dayIndex: 4, dayCount: 5, pace: "balanced" })).toBe(2);
    expect(getPlannerDayMinimumItems({ dayIndex: 2, dayCount: 5, pace: "relaxed" })).toBe(2);
    expect(getPlannerDayMinimumItems({ dayIndex: 2, dayCount: 5, pace: "balanced" })).toBe(3);
    expect(getPlannerDayMinimumItems({ dayIndex: 2, dayCount: 5, pace: "packed" })).toBe(4);
  });
});

describe("validatePlannerPlanQuality", () => {
  it("passes balanced 5-day with 2,4,4,3,2", () => {
    const result = validatePlannerPlanQuality(planWithCounts([2, 4, 4, 3, 2]), draft());
    expect(result.ok).toBe(true);
  });

  it("fails balanced 5-day all-2 sparse plan on first full day", () => {
    const result = validatePlannerPlanQuality(planWithCounts([2, 2, 2, 2, 2]), draft());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue).toEqual({
      code: "day_item_density_too_low",
      day: 2,
      actual: 2,
      expectedMinimum: 3,
      pace: "balanced",
      dayRole: "full",
    });
  });

  it("passes relaxed arrival/full/departure mins 2,2,3,2", () => {
    const result = validatePlannerPlanQuality(
      planWithCounts([2, 2, 3, 2]),
      draft({
        pace: "relaxed",
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-04",
          durationDays: 4,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("fails packed full day with only 3 items", () => {
    const result = validatePlannerPlanQuality(
      planWithCounts([2, 3, 2]),
      draft({
        pace: "packed",
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          durationDays: 3,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.day).toBe(2);
    expect(result.issue.expectedMinimum).toBe(4);
    expect(result.issue.actual).toBe(3);
  });

  it("one-day trip: 2 pass, 1 fail", () => {
    const oneDayDraft = draft({
      dates: {
        mode: "fixed",
        startDate: "2026-10-01",
        endDate: "2026-10-01",
        durationDays: 1,
      },
    });
    expect(validatePlannerPlanQuality(planWithCounts([2]), oneDayDraft).ok).toBe(true);
    const fail = validatePlannerPlanQuality(planWithCounts([1]), oneDayDraft);
    expect(fail.ok).toBe(false);
    if (fail.ok) return;
    expect(fail.issue.dayRole).toBe("one_day");
    expect(fail.issue.expectedMinimum).toBe(2);
  });

  it("two-day trip: 2+2 pass", () => {
    const result = validatePlannerPlanQuality(
      planWithCounts([2, 2]),
      draft({
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-02",
          durationDays: 2,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("schema still allows 1-item day while quality fails", () => {
    const sparse = planWithCounts([1, 1, 1]);
    expect(plannerPlanSchema.safeParse(sparse).success).toBe(true);
    const quality = validatePlannerPlanQuality(
      sparse,
      draft({
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          durationDays: 3,
        },
      }),
    );
    expect(quality.ok).toBe(false);
  });

  it("does not lower hard minimum for less_walking constraint text", () => {
    const result = validatePlannerPlanQuality(
      planWithCounts([2, 2, 2]),
      draft({
        additionalRequest: "많이 걷지 않는 일정으로 구성해주세요.",
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          durationDays: 3,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.expectedMinimum).toBe(3);
  });

  it("counts meal/rest/transport in items.length", () => {
    const plan = planWithCounts([2, 3, 2]);
    plan.days[1]!.items = [
      item(1, "attraction"),
      item(2, "food"),
      item(3, "rest"),
    ];
    expect(validatePlannerPlanQuality(plan, draft({
      dates: {
        mode: "fixed",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        durationDays: 3,
      },
    })).ok).toBe(true);

    const withTransport = planWithCounts([2, 3, 2]);
    withTransport.days[1]!.items = [
      item(1, "transport"),
      item(2, "food"),
      item(3, "attraction"),
    ];
    expect(
      validatePlannerPlanQuality(
        withTransport,
        draft({
          dates: {
            mode: "fixed",
            startDate: "2026-10-01",
            endDate: "2026-10-03",
            durationDays: 3,
          },
        }),
      ).ok,
    ).toBe(true);
  });

  it("arrival/departure at 2 do not fail balanced when full days meet min", () => {
    const result = validatePlannerPlanQuality(planWithCounts([2, 3, 4, 3, 2]), draft());
    expect(result.ok).toBe(true);
  });
});

describe("getPlannerItemDensityStats", () => {
  it("computes total/min/max/avg for [2,4,4,3,2]", () => {
    const stats = getPlannerItemDensityStats(planWithCounts([2, 4, 4, 3, 2]));
    expect(stats).toEqual({
      totalItemCount: 15,
      minItemsPerDay: 2,
      maxItemsPerDay: 4,
      averageItemsPerDay: 3,
    });
  });
});

describe("pace hard minimum matrix", () => {
  const cases: Array<{ pace: PlannerPace; fullMin: number }> = [
    { pace: "relaxed", fullMin: 2 },
    { pace: "balanced", fullMin: 3 },
    { pace: "packed", fullMin: 4 },
  ];
  it.each(cases)("$pace full-day hard min $fullMin", ({ pace, fullMin }) => {
    expect(getPlannerDayMinimumItems({ dayIndex: 1, dayCount: 3, pace })).toBe(fullMin);
  });
});
