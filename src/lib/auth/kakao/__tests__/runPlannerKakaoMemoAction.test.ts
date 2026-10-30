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
const sendKakaoMemoDefault = vi.fn(
  async (
    params: unknown,
  ): Promise<{ ok: true } | { ok: false; code: string; status?: number }> => {
    void params;
    return { ok: true };
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

vi.mock("@/lib/auth/kakao/kakaoMemo", () => ({
  sendKakaoMemoDefault: (params: unknown) => sendKakaoMemoDefault(params),
}));

vi.mock("@/lib/analytics/persistAnalyticsEventAdmin", () => ({
  persistAnalyticsEventAdmin: (payload: unknown) => persistAnalyticsEventAdmin(payload),
}));

import { runPlannerKakaoMemoAction } from "@/lib/auth/kakao/runPlannerKakaoMemoAction";

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const MEMBER_ID = "11111111-2222-4333-8444-555555555555";

function savedSession(over: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    memberId: MEMBER_ID,
    status: "saved",
    anonymousKey: "anon",
    sourceProductId: null,
    plan: {
      title: "오사카 3박 4일 여행 플랜",
      destination: { name: "오사카" },
      tripOverview: {
        days: 4,
        nights: 3,
        startDate: "2025-11-10",
        endDate: "2025-11-13",
        travelersSummary: "2",
        styleSummary: "food",
      },
      days: [],
    },
    input: {},
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("runPlannerKakaoMemoAction", () => {
  beforeEach(() => {
    getMemberKakaoProviderUserId.mockReset();
    getPlannerSessionById.mockReset();
    sendKakaoMemoDefault.mockReset();
    persistAnalyticsEventAdmin.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
  });

  it("sends memo when Kakao identity and ownership match", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession());
    sendKakaoMemoDefault.mockResolvedValue({ ok: true });

    const tokens = { accessToken: "live-token", refreshToken: "live-refresh" };
    const result = await runPlannerKakaoMemoAction({
      tokens,
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.redirectPath).toContain("plannerKakaoMemo=sent");
    expect(sendKakaoMemoDefault).toHaveBeenCalledTimes(1);
    expect(tokens.accessToken).toBe("");
    expect(tokens.refreshToken).toBe("");
  });

  it("rejects different Kakao account without sending", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-owned");
    getPlannerSessionById.mockResolvedValue(savedSession());

    const result = await runPlannerKakaoMemoAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-other",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(false);
    expect(result.failureCode).toBe("account_mismatch");
    expect(sendKakaoMemoDefault).not.toHaveBeenCalled();
    expect(result.redirectPath).toContain("plannerKakaoMemo=failed");
  });

  it("rejects ownership failure", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession({ memberId: "other-member" }));

    const result = await runPlannerKakaoMemoAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.failureCode).toBe("forbidden");
    expect(sendKakaoMemoDefault).not.toHaveBeenCalled();
  });

  it("maps memo API failure to failed redirect without unsaving", async () => {
    getMemberKakaoProviderUserId.mockResolvedValue("kakao-123");
    getPlannerSessionById.mockResolvedValue(savedSession());
    sendKakaoMemoDefault.mockResolvedValue({ ok: false, code: "rate_limited", status: 429 });

    const result = await runPlannerKakaoMemoAction({
      tokens: { accessToken: "t" },
      kakaoProviderUserId: "kakao-123",
      memberId: MEMBER_ID,
      plannerSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(false);
    expect(result.failureCode).toBe("memo_send_failed");
    expect(result.redirectPath).toContain("failed");
  });
});
