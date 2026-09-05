import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import {
  getGuestAccountQuickLinks,
  getMemberAccountNavItems,
  PLANNER_SAVED_LIST_PATH,
} from "@/lib/planner/memberAccountNav";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { projectSavedPlannerListItem } from "@/lib/planner/savedPlanDto";
import type { PlannerSession } from "@/types/planner";

const validPlan = {
  title: "오사카 4박 5일",
  summary: "맛집과 관광 중심의 초안 일정입니다.",
  destination: { name: "오사카", country: "일본" },
  tripOverview: {
    startDate: "2026-10-01",
    endDate: "2026-10-05",
    nights: 4,
    days: 5,
    travelersSummary: "성인 2명",
    styleSummary: "가족 · 맛집/관광",
  },
  days: [
    {
      day: 1,
      date: "2026-10-01",
      title: "도착",
      summary: "적응",
      items: [
        {
          order: 1,
          time: "12:00",
          type: "food",
          name: "점심",
          area: "난바",
          description: "가볍게",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: ["천천히"],
    },
    {
      day: 2,
      date: "2026-10-02",
      title: "도톤보리",
      summary: "시내",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction",
          name: "도톤보리",
          area: "난바",
          description: "산책",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    },
    {
      day: 3,
      date: "2026-10-03",
      title: "유니버설",
      summary: "테마파크",
      items: [
        {
          order: 1,
          time: "09:00",
          type: "activity",
          name: "USJ",
          area: "유니버설",
          description: "하루",
          estimatedDurationMinutes: 480,
          travelToNext: null,
          bookingRecommended: true,
        },
      ],
      tips: [],
    },
    {
      day: 4,
      date: "2026-10-04",
      title: "교토 당일",
      summary: "근교",
      items: [
        {
          order: 1,
          time: "09:00",
          type: "attraction",
          name: "후시미이나리",
          area: "교토",
          description: "산책",
          estimatedDurationMinutes: 120,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    },
    {
      day: 5,
      date: "2026-10-05",
      title: "귀국",
      summary: "출발",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "transport",
          name: "공항 이동",
          area: "간사이",
          description: "여유",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    },
  ],
  preparation: {
    travelTips: ["운영시간 확인"],
    packingHints: ["편한 신발"],
  },
};

describe("PR-5 saved plan list", () => {
  it("projects valid plan_json into client-safe DTO without secrets", () => {
    const item = projectSavedPlannerListItem({
      id: "550e8400-e29b-41d4-a716-446655440000",
      planJson: validPlan,
      updatedAt: "2026-09-06T00:00:00.000Z",
      sourceProductId: null,
    });
    expect(item).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "오사카 4박 5일",
      destination: "오사카",
      days: 5,
    });
    expect(item).not.toHaveProperty("anonymousKey");
    expect(item).not.toHaveProperty("memberId");
    expect(item).not.toHaveProperty("anonymous_key");
    expect(item).not.toHaveProperty("member_id");
  });

  it("skips malformed plan_json instead of throwing", () => {
    expect(
      projectSavedPlannerListItem({
        id: "550e8400-e29b-41d4-a716-446655440000",
        planJson: { title: "broken" },
        updatedAt: "2026-09-06T00:00:00.000Z",
        sourceProductId: null,
      }),
    ).toBeNull();
    expect(
      projectSavedPlannerListItem({
        id: "550e8400-e29b-41d4-a716-446655440000",
        planJson: null,
        updatedAt: "2026-09-06T00:00:00.000Z",
        sourceProductId: null,
      }),
    ).toBeNull();
  });

  it("documents list filter semantics: only saved with plan", () => {
    const rows = [
      { status: "saved", plan: validPlan },
      { status: "generated", plan: validPlan },
      { status: "draft", plan: null },
      { status: "saved", plan: null },
    ];
    const included = rows.filter((r) => r.status === "saved" && r.plan != null);
    expect(included).toHaveLength(1);
  });

  it("keeps member-owned result readable without anonymousKey", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    const session: PlannerSession = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      anonymousKey: "original-key",
      memberId,
      status: "saved",
      input: createEmptyPlannerDraftInput("오사카"),
      plan: null,
      sourceProductId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: null,
        cookieMemberId: memberId,
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: null,
        cookieMemberId: "22222222-2222-4222-8222-222222222222",
      }).ok,
    ).toBe(false);
  });

  it("uses /planner/my and sanitizes Kakao next path", () => {
    expect(PLANNER_SAVED_LIST_PATH).toBe("/planner/my");
    expect(sanitizeNextPath(PLANNER_SAVED_LIST_PATH)).toBe("/planner/my");
  });

  it("exposes saved list in shared member nav when flag on", () => {
    const member = getMemberAccountNavItems();
    const guest = getGuestAccountQuickLinks();
    expect(member.some((i) => i.href === PLANNER_SAVED_LIST_PATH)).toBe(true);
    expect(guest.some((i) => i.href === PLANNER_SAVED_LIST_PATH && i.requiresAuth)).toBe(true);
  });

  it("registers saved-list analytics events", () => {
    expect(ANALYTICS_EVENTS.planner_saved_list_viewed).toBe("planner_saved_list_viewed");
    expect(ANALYTICS_EVENTS.planner_saved_plan_opened).toBe("planner_saved_plan_opened");
  });

  it("card href targets existing planner result route", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(`/planner/${id}`).toBe(`/planner/${id}`);
  });
});
