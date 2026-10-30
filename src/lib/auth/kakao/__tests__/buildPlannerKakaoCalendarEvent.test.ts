import { describe, expect, it } from "vitest";
import {
  buildPlannerKakaoCalendarEvent,
  buildPlannerKakaoCalendarTitle,
  toKakaoAllDayExclusiveEndUtcMidnight,
  toKakaoAllDayUtcMidnight,
} from "@/lib/auth/kakao/buildPlannerKakaoCalendarEvent";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function plan(over: Partial<PlannerPlan> = {}): PlannerPlan {
  return {
    title: "오사카 3박 4일 여행 플랜",
    summary: "summary",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      days: 4,
      nights: 3,
      startDate: "2026-11-10",
      endDate: "2026-11-13",
      travelersSummary: "성인 2",
      styleSummary: "맛집",
    },
    days: [
      {
        day: 1,
        date: "2026-11-10",
        title: "Day 1",
        summary: "s",
        items: [],
      },
    ],
    preparation: {
      travelTips: ["tip"],
      packingHints: ["pack"],
    },
    ...over,
  } as PlannerPlan;
}

describe("buildPlannerKakaoCalendarEvent", () => {
  it("builds Osaka all-day primary event with exclusive end", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const payload = buildPlannerKakaoCalendarEvent({
      plan: plan(),
      sessionId,
      originText: "서울",
    });

    expect(payload.calendar_id).toBe("primary");
    expect(payload.event.title).toBe("오사카 3박 4일 여행 플랜");
    expect(payload.event.time).toEqual({
      start_at: "2026-11-10T00:00:00Z",
      end_at: "2026-11-14T00:00:00Z",
      time_zone: "Asia/Seoul",
      all_day: true,
      lunar: false,
    });
    expect(payload.event.description).toContain("서울 → 오사카");
    expect(payload.event.description).toContain("2026.11.10 ~ 2026.11.13");
    expect(payload.event.description).toContain(`/planner/open/${sessionId}`);
    expect(payload.event.location).toEqual({ name: "오사카" });
    expect(payload.event).not.toHaveProperty("reminders");
  });

  it("clamps title to 50 and description to 5000", () => {
    const longTitle = "가".repeat(80);
    const title = buildPlannerKakaoCalendarTitle(plan({ title: longTitle }));
    expect(title.length).toBeLessThanOrEqual(50);

    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
    const payload = buildPlannerKakaoCalendarEvent({
      plan: plan({ title: longTitle }),
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      originText: "x".repeat(6000),
    });
    expect(payload.event.title.length).toBeLessThanOrEqual(50);
    expect(payload.event.description.length).toBeLessThanOrEqual(5000);
  });

  it("falls back title to destination 여행", () => {
    expect(buildPlannerKakaoCalendarTitle(plan({ title: "   " }))).toBe("오사카 여행");
  });

  it("uses exclusive end helper", () => {
    expect(toKakaoAllDayUtcMidnight("2026-11-10")).toBe("2026-11-10T00:00:00Z");
    expect(toKakaoAllDayExclusiveEndUtcMidnight("2026-11-13")).toBe("2026-11-14T00:00:00Z");
  });

  it("rejects missing dates", () => {
    expect(() =>
      buildPlannerKakaoCalendarEvent({
        plan: plan({
          tripOverview: {
            days: 4,
            nights: 3,
            startDate: null,
            endDate: null,
            travelersSummary: "2",
            styleSummary: "s",
          },
        }),
        sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }),
    ).toThrow(/missing_trip_dates/);
  });
});
