import { beforeEach, describe, expect, it, vi } from "vitest";

const getMemberKakaoProviderUserId = vi.fn(
  async (memberId: string): Promise<string | null> => {
    void memberId;
    return null;
  },
);
const getPlannerSessionById = vi.fn(async (id: string): Promise<unknown> => {
  void id;
  return null;
});
const createKakaoCalendarEvent = vi.fn(
  async (
    params: unknown,
  ): Promise<{ ok: true; eventId: string } | { ok: false; code: string; status?: number }> => {
    void params;
    return { ok: true, eventId: "evt_1" };
  },
);
const persistAnalyticsEventAdmin = vi.fn(async (payload: unknown) => {
  void payload;
});

vi.mock("@/lib/auth/memberAuthService", () => ({
  getMemberKakaoProviderUserId: (memberId: string) => getMemberKakaoProviderUserId(memberId),
}));

vi.mock("@/lib/planner/repository", () => ({
  getPlannerSessionById: (id: string) => getPlannerSessionById(id),
}));

vi.mock("@/lib/auth/kakao/kakaoCalendar", () => ({
  createKakaoCalendarEvent: (params: unknown) => createKakaoCalendarEvent(params),
}));

vi.mock("@/lib/analytics/persistAnalyticsEventAdmin", () => ({
  persistAnalyticsEventAdmin: (payload: unknown) => persistAnalyticsEventAdmin(payload),
}));

import { runPlannerKakaoCalendarAction } from "@/lib/auth/kakao/runPlannerKakaoCalendarAction";

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const MEMBER_ID = "11111111-2222-4333-8444-555555555555";

function savedSession(over: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    memberId: MEMBER_ID,
    status: "saved",
    anonymousKey: "anon",
    sourceProductId: null,
    input: { origin: { text: "서울" }, destination: { text: "오사카" } },
    plan: {
      title: "오사카 3박 4일 여행 플랜",
      destination: { name: "오사카" },
      tripOverview: {
        days: 4,
        nights: 3,
        startDate: "2026-11-10",
        endDate: "2026-11-13",
        travelersSummary: "2",
        styleSummary: "food",
      },
      days: [],
    },
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("runPlannerKakaoCalendarAction", () => {
  beforeEach(() => {
    getMemberKakaoProviderUserId.mockReset();
    getPlannerSessionById.mockReset();
    createKakaoCalendarEvent.mockReset();
    persistAnalyticsEventAdmin.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
  });

  it("creates calendar event when identity and ownership match", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession());
    createKakaoCalendarEvent.mockResolvedValue({ ok: true, eventId: "evt_ok" });

    const tokens = { accessToken: "live-token", refreshToken: "live-refresh" };
    const result = await runPlannerKakaoCalendarAction({
      tokens,
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.redirectPath).toContain("plannerKakaoCalendar=added");
    expect(createKakaoCalendarEvent).toHaveBeenCalledTimes(1);
    expect(tokens.accessToken).toBe("");
    expect(tokens.refreshToken).toBe("");
  });

  it("rejects account mismatch without API call", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-owned");
    getPlannerSessionById.mockResolvedValue(savedSession());

    const result = await runPlannerKakaoCalendarAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-other",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.failureCode).toBe("account_mismatch");
    expect(createKakaoCalendarEvent).not.toHaveBeenCalled();
  });

  it("rejects ownership failure", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession({ memberId: "other" }));

    const result = await runPlannerKakaoCalendarAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.failureCode).toBe("forbidden");
    expect(createKakaoCalendarEvent).not.toHaveBeenCalled();
  });

  it("maps permission denied without unsaving", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession());
    createKakaoCalendarEvent.mockResolvedValue({
      ok: false,
      code: "calendar_permission_denied",
      status: 403,
    });

    const result = await runPlannerKakaoCalendarAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(false);
    expect(result.failureCode).toBe("calendar_permission_denied");
    expect(result.redirectPath).toContain("failed");
  });
});
