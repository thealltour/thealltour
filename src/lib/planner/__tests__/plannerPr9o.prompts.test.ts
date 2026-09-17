import { describe, expect, it } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import {
  PLANNER_EDIT_SYSTEM_PROMPT,
  PLANNER_PLAN_SYSTEM_PROMPT,
  buildPlannerEditUserPrompt,
  buildPlannerPlanUserPrompt,
} from "@/lib/planner/prompts";
import { addDaysToIsoDate, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerDraftInput } from "@/types/planner";

function draft(overrides?: Partial<PlannerDraftInput>): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
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

function minimalPlan(destinationName: string): PlannerPlan {
  return {
    title: `${destinationName} 2박 3일`,
    summary: "요약",
    destination: { name: destinationName, country: null },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
      travelersSummary: "성인 2명",
      styleSummary: "균형",
    },
    days: [0, 1, 2].map((i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루",
      items: [
        {
          order: 1,
          time: null,
          type: "other" as const,
          name: "일정",
          area: null,
          description: "설명",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    })),
    preparation: {
      travelTips: ["운영시간 확인"],
      packingHints: ["편한 신발"],
    },
  };
}

describe("PR-9O origin-aware planner generation prompts", () => {
  it("includes origin and destination lines in user prompt", () => {
    const prompt = buildPlannerPlanUserPrompt(
      draft({
        origin: { text: "서울" },
        destination: { text: "오사카" },
      }),
    );
    expect(prompt).toContain("[출발지] 서울");
    expect(prompt).toContain("[목적지] 오사카");
  });

  it("uses draft.origin.text without Seoul/Osaka special-case", () => {
    const prompt = buildPlannerPlanUserPrompt(
      draft({
        origin: { text: "부산" },
        destination: { text: "후쿠오카" },
      }),
    );
    expect(prompt).toContain("[출발지] 부산");
    expect(prompt).toContain("[목적지] 후쿠오카");
    expect(prompt).not.toContain("[출발지] 서울");
  });

  it("system prompt lists origin as an input condition", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toMatch(/origin\/destination/);
  });

  it("system prompt forbids origin-city sightseeing and keeps destination-centric plans", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("목적지 중심");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("출발지 도시의 관광 일정");
  });

  it("system prompt includes Day 1 arrival-day guidance", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("첫날(Day 1)은 목적지 도착일");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("이동·체크인·휴식");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("과도하게 채우지");
  });

  it("system prompt includes last-day departure guidance", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("마지막 날은 귀국 또는 다음 이동일");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("이동 여유");
  });

  it("system prompt prevents airport/time hallucination without booking input", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("특정 공항명");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("중립 표현");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toMatch(/출도착 시각|비행 소요시간/);
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("확정 예약·가격·항공·호텔 재고");
  });

  it("edit user prompt includes origin from draft", () => {
    const prompt = buildPlannerEditUserPrompt({
      draft: draft({
        origin: { text: "부산" },
        destination: { text: "오사카" },
      }),
      currentPlan: minimalPlan("오사카"),
      instruction: "맛집을 하나 더 넣어주세요.",
    });
    expect(prompt).toContain("origin: 부산");
    expect(prompt).toContain("destination: 오사카");
  });

  it("edit system prompt keeps origin-aware destination-centric constraints", () => {
    expect(PLANNER_EDIT_SYSTEM_PROMPT).toContain("출발지");
    expect(PLANNER_EDIT_SYSTEM_PROMPT).toContain("목적지 중심");
    expect(PLANNER_EDIT_SYSTEM_PROMPT).toContain("특정 공항명");
  });
});
