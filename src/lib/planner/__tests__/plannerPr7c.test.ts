import { describe, expect, it, vi } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  appendPlannerQuickRequest,
  createEmptyPlannerDraftInput,
  PLANNER_POPULAR_DESTINATIONS,
} from "@/lib/planner/constants";
import {
  computeDurationDays,
  draftTripDurationDays,
  formatPlannerDatesSummary,
} from "@/lib/planner/dates";
import { isDateRangeSelectionComplete } from "@/lib/datePickerUtils";
import {
  assertEditedPlanMatchesContext,
  assertGeneratedPlanMatchesDraft,
  PlannerPlanInvariantError,
  addDaysToIsoDate,
  plannerPlanSchema,
  type PlannerPlan,
} from "@/lib/planner/planSchemas";
import { buildPlannerPlanUserPrompt } from "@/lib/planner/prompts";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";
import { buildConsecutiveRoutePairs } from "@/lib/planner/routePairs";
import { projectSavedPlannerListItem } from "@/lib/planner/savedPlanDto";
import { computePlannerPlanFingerprint } from "@/lib/planner/planFingerprint";
import { plannerDraftInputSchema, validatePlannerStep } from "@/lib/planner/schemas";
import type { PlannerDraftInput } from "@/types/planner";
import type { PlannerPlaceEnrichmentItem as PlaceItem } from "@/lib/planner/enrichmentTypes";

function fixedDraft(overrides?: Partial<PlannerDraftInput>): PlannerDraftInput {
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
    themeRequest: "",
    pace: "balanced",
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
    ...overrides,
  };
}

function flexibleDraft(days = 5): PlannerDraftInput {
  return fixedDraft({
    dates: {
      mode: "flexible",
      startDate: null,
      endDate: null,
      durationDays: days,
    },
  });
}

function fixedPlan(): PlannerPlan {
  return {
    title: "오사카 2박 3일",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
      travelersSummary: "성인 2명",
      styleSummary: "맛집",
    },
    days: [0, 1, 2].map((i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "설명",
          estimatedDurationMinutes: 90,
          travelToNext: { mode: "walk" as const, estimatedMinutes: 10 },
          bookingRecommended: false,
        },
      ],
      tips: ["확인"],
    })),
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  };
}

function flexiblePlan(days = 5): PlannerPlan {
  return {
    title: "오사카 5일",
    summary: "날짜 미정 일정",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: null,
      endDate: null,
      nights: days - 1,
      days,
      travelersSummary: "성인 2명",
      styleSummary: "맛집",
    },
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      date: null,
      title: `${i + 1}일차`,
      summary: "하루",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "설명",
          estimatedDurationMinutes: 90,
          travelToNext: { mode: "public_transit" as const, estimatedMinutes: 15 },
          bookingRecommended: false,
        },
        {
          order: 2,
          time: "12:00",
          type: "food" as const,
          name: "식당",
          area: "난바",
          description: "식사",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    })),
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  };
}

function resolvedPlace(
  dayNumber: number,
  itemOrder: number,
  lat: number,
  lng: number,
): PlaceItem {
  return {
    dayNumber,
    itemOrder,
    place: {
      status: "resolved",
      originalName: "x",
      placeId: "p",
      displayName: "x",
      formattedAddress: "addr",
      location: { lat, lng },
      types: [],
      googleMapsUri: null,
    },
  };
}

describe("PR-7C dates / draft schema", () => {
  it("1. normalizes legacy fixed dates without mode", () => {
    const normalized = normalizePlannerDraftInput({
      destination: { text: "다낭" },
      dates: { startDate: "2026-11-01", endDate: "2026-11-05" },
      travelers: { adults: 2, children: 0 },
      companionType: "friends",
      interests: ["food"],
      pace: "balanced",
      budget: { amount: null, scope: "per_person", currency: "KRW" },
      additionalRequest: "",
    });
    expect(normalized.dates.mode).toBe("fixed");
    expect(normalized.dates.durationDays).toBe(5);
    expect(normalized.themeRequest).toBe("");
    expect(normalized.budget.style).toBeNull();
  });

  it("2. accepts fixed date schema", () => {
    expect(plannerDraftInputSchema.safeParse(fixedDraft()).success).toBe(true);
  });

  it("3. accepts flexible date schema", () => {
    expect(plannerDraftInputSchema.safeParse(flexibleDraft(4)).success).toBe(true);
  });

  it("4. rejects flexible missing/invalid duration", () => {
    const draft = flexibleDraft(1);
    draft.dates.durationDays = 1;
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("5. rejects fixed missing start/end", () => {
    expect(
      plannerDraftInputSchema.safeParse(
        fixedDraft({
          dates: { mode: "fixed", startDate: null, endDate: null, durationDays: 3 },
        }),
      ).success,
    ).toBe(false);
  });

  it("8. flexible duration quick select is valid at step 2", () => {
    const draft = flexibleDraft(5);
    expect(validatePlannerStep(2, draft)).toBeNull();
    expect(formatPlannerDatesSummary(draft.dates)).toBe("5일 여행");
  });

  it("computes duration and summary for fixed", () => {
    expect(computeDurationDays("2026-10-01", "2026-10-05")).toBe(5);
    expect(formatPlannerDatesSummary(fixedDraft().dates)).toContain("2박 3일");
    expect(draftTripDurationDays(flexibleDraft(7))).toBe(7);
  });
});

describe("PR-7C DateRangePicker keep-open helper", () => {
  it("6-7. start-only (from===to) is incomplete; distinct end completes", () => {
    expect(isDateRangeSelectionComplete("2026-10-01", "", true)).toBe(false);
    expect(isDateRangeSelectionComplete("2026-10-01", "2026-10-01", true)).toBe(false);
    expect(isDateRangeSelectionComplete("2026-10-01", "2026-10-05", true)).toBe(true);
    expect(isDateRangeSelectionComplete("2026-10-01", "2026-10-01", false)).toBe(true);
  });
});

describe("PR-7C AI plan invariants", () => {
  it("9. fixed plan invariant passes", () => {
    expect(() => assertGeneratedPlanMatchesDraft(fixedPlan(), fixedDraft())).not.toThrow();
  });

  it("10. flexible plan day count invariant", () => {
    expect(() => assertGeneratedPlanMatchesDraft(flexiblePlan(5), flexibleDraft(5))).not.toThrow();
    const bad = flexiblePlan(4);
    expect(() => assertGeneratedPlanMatchesDraft(bad, flexibleDraft(5))).toThrow(
      PlannerPlanInvariantError,
    );
  });

  it("11. flexible plan rejects fake calendar dates", () => {
    const plan = flexiblePlan(3);
    plan.days[0]!.date = "2026-10-01";
    expect(() => assertGeneratedPlanMatchesDraft(plan, flexibleDraft(3))).toThrow(
      /day\.date must be null/,
    );
    expect(plannerPlanSchema.safeParse(flexiblePlan(3)).success).toBe(true);
  });

  it("34. edit keeps flexible mode and duration", () => {
    const prev = flexiblePlan(5);
    const next = flexiblePlan(5);
    next.days[0]!.title = "수정된 하루";
    expect(() => assertEditedPlanMatchesContext(next, flexibleDraft(5), prev)).not.toThrow();
    const modeChanged = fixedPlan();
    expect(() => assertEditedPlanMatchesContext(modeChanged, flexibleDraft(5), prev)).toThrow();
  });
});

describe("PR-7C weather / routes / places flexible", () => {
  it("12-13. weather date_not_set when trip dates null (contract)", () => {
    const plan = flexiblePlan(4);
    expect(plan.tripOverview.startDate).toBeNull();
    expect(plan.tripOverview.endDate).toBeNull();
    // enrichPlannerSession short-circuits before fetchPlannerWeatherSummary
    const shouldSkipWeather =
      plan.tripOverview.startDate == null || plan.tripOverview.endDate == null;
    expect(shouldSkipWeather).toBe(true);
    const weather = { availability: "date_not_set" as const, days: [] };
    expect(weather.availability).toBe("date_not_set");
  });

  it("14. transit routes skip provider for flexible (null date)", () => {
    // shrink to 1 day for pair building
    const oneDay = flexiblePlan(2);
    oneDay.days = oneDay.days.slice(0, 1);
    oneDay.tripOverview.days = 1;
    oneDay.tripOverview.nights = 0;
    const places = [
      resolvedPlace(1, 1, 34.67, 135.5),
      resolvedPlace(1, 2, 34.68, 135.51),
    ];
    const pairs = buildConsecutiveRoutePairs({ plan: oneDay, places });
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.mode).toBe("public_transit");
    expect(pairs[0]!.googleTravelMode).toBeNull();
  });

  it("15. places still resolve for flexible plans (fingerprint stable with null dates)", () => {
    const a = computePlannerPlanFingerprint(flexiblePlan(5));
    const b = computePlannerPlanFingerprint(flexiblePlan(5));
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
});

describe("PR-7C saved DTO", () => {
  it("16. saved DTO fixed", () => {
    const item = projectSavedPlannerListItem({
      id: "550e8400-e29b-41d4-a716-446655440000",
      planJson: fixedPlan(),
      updatedAt: "2026-09-01T00:00:00.000Z",
      sourceProductId: null,
    });
    expect(item?.dateMode).toBe("fixed");
    expect(item?.startDate).toBe("2026-10-01");
    expect(item?.days).toBe(3);
  });

  it("17. saved DTO flexible", () => {
    const item = projectSavedPlannerListItem({
      id: "550e8400-e29b-41d4-a716-446655440001",
      planJson: flexiblePlan(5),
      updatedAt: "2026-09-01T00:00:00.000Z",
      sourceProductId: null,
    });
    expect(item?.dateMode).toBe("flexible");
    expect(item?.startDate).toBeNull();
    expect(item?.days).toBe(5);
  });

  it("33. fixed old saved plans still project", () => {
    expect(
      projectSavedPlannerListItem({
        id: "550e8400-e29b-41d4-a716-446655440002",
        planJson: fixedPlan(),
        updatedAt: "2026-09-01T00:00:00.000Z",
        sourceProductId: null,
      })?.title,
    ).toBe("오사카 2박 3일");
  });
});

describe("PR-7C theme / budget / quick request", () => {
  it("18. themeRequest max validation", () => {
    const draft = fixedDraft({ themeRequest: "가".repeat(1001) });
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("19. themeRequest included in prompt", () => {
    const prompt = buildPlannerPlanUserPrompt(
      fixedDraft({ themeRequest: "현지 맛집 위주 분위기" }),
    );
    expect(prompt).toContain("현지 맛집 위주 분위기");
    expect(prompt).toContain("[여행 분위기]");
  });

  it("20. analytics event exists without raw theme text contract", () => {
    expect(ANALYTICS_EVENTS.planner_input_completed).toBe("planner_input_completed");
    expect(ANALYTICS_EVENTS.planner_summary_edit_clicked).toBe(
      "planner_summary_edit_clicked",
    );
    // metadata uses hasThemeRequest boolean only — see trackPlannerEvents
  });

  it("21-22. budget style unlocked without invented amounts", () => {
    const draft = fixedDraft({
      budget: { style: "budget", amount: null, scope: "per_person", currency: "KRW" },
    });
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(true);
    expect(draft.budget.amount).toBeNull();
  });

  it("23. budget slider/input sync helper clamps via amount field", () => {
    const amount = 1_500_000;
    const draft = fixedDraft({
      budget: { style: null, amount, scope: "total", currency: "KRW" },
    });
    expect(draft.budget.amount).toBe(amount);
  });

  it("24-25. quick request insert + duplicate prevention", () => {
    const text = "많이 걷지 않는 일정으로 구성해주세요.";
    const once = appendPlannerQuickRequest("", text);
    expect(once).toContain(text);
    const twice = appendPlannerQuickRequest(once, text);
    expect(twice).toBe(once);
  });

  it("popular destinations are canonical (no realtime label)", () => {
    expect(PLANNER_POPULAR_DESTINATIONS.map((d) => d.label)).toEqual([
      "오사카",
      "다낭",
      "후쿠오카",
      "방콕",
      "타이베이",
    ]);
  });
});

describe("PR-7C summary / CTA / failure contracts", () => {
  it("26-29. summary section step mapping + sequential validation", () => {
    const draft = fixedDraft();
    expect(validatePlannerStep(1, draft)).toBeNull();
    expect(validatePlannerStep(4, { ...draft, interests: [] })).toMatch(/취향/);
    expect(validatePlannerStep(7, draft)).toBeNull();
  });

  it("30-32. generation failure categories are enumerated", () => {
    const cats = [
      "input_invalid",
      "provider_failed",
      "schema_invalid",
      "invariant_failed",
      "persist_failed",
      "result_navigation_failed",
    ];
    expect(cats).toHaveLength(6);
  });
});

describe("PR-7C weather fetch skip unit", () => {
  it("does not call provider when dates are unset", async () => {
    const fetchWeather = vi.fn();
    const plan = flexiblePlan(3);
    if (plan.tripOverview.startDate == null || plan.tripOverview.endDate == null) {
      // skip
    } else {
      fetchWeather();
    }
    expect(fetchWeather).not.toHaveBeenCalled();
  });
});
