import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerInterest, PlannerSession } from "@/types/planner";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";

const getMemberSessionFromCookies = vi.hoisted(() => vi.fn());
const getPlannerSessionById = vi.hoisted(() => vi.fn());
const cookies = vi.hoisted(() => vi.fn(async () => ({})));
const generateEditedPlannerPlan = vi.hoisted(() => vi.fn());
const persistEditedPlannerPlan = vi.hoisted(() => vi.fn());
const reservePlannerAiEditQuota = vi.hoisted(() => vi.fn());
const consumePlannerAiEditQuota = vi.hoisted(() => vi.fn());
const releasePlannerAiEditQuota = vi.hoisted(() => vi.fn());
const reservePlannerGenerationQuota = vi.hoisted(() => vi.fn());
const persistAnalyticsEventAdmin = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/config/featureFlags", () => ({
  ENABLE_FREE_TRAVEL_PLANNER: true,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("@/lib/memberSession", () => ({
  getMemberSessionFromCookies,
}));

vi.mock("@/lib/planner/repository", () => ({
  getPlannerSessionById,
}));

vi.mock("@/lib/planner/planVersionRepository", () => ({
  persistEditedPlannerPlan,
}));

vi.mock("@/lib/planner/generatePlan", () => ({
  generateEditedPlannerPlan,
  getPlannerGenerateSafeLogFields: () => ({
    errorCode: null,
    stage: null,
    provider: null,
    modelId: null,
    providerStatusCode: null,
    sdkFailureType: null,
  }),
  getPlannerItemDensityStats: () => ({
    totalItemCount: 1,
    minItemsPerDay: 1,
    maxItemsPerDay: 1,
    averageItemsPerDay: 1,
  }),
  toClientEditErrorMessage: () => "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
}));

vi.mock("@/lib/planner/quota/repository", () => ({
  reservePlannerAiEditQuota,
  consumePlannerAiEditQuota,
  releasePlannerAiEditQuota,
  reservePlannerGenerationQuota,
  consumePlannerGenerationQuota: vi.fn(),
  releasePlannerGenerationQuota: vi.fn(),
}));

vi.mock("@/lib/analytics/persistAnalyticsEventAdmin", () => ({
  persistAnalyticsEventAdmin,
}));

import { POST } from "../route";

function validDraft() {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: {
      mode: "fixed" as const,
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      durationDays: 2,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple" as const,
    interests: ["food"] as PlannerInterest[],
    pace: "balanced" as const,
    budget: {
      style: null,
      amount: null,
      scope: "per_person" as const,
      currency: "KRW" as const,
    },
    additionalRequest: "",
  };
}

function validPlan(): PlannerPlan {
  return plannerPlanSchema.parse({
    title: "오사카 여행",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      nights: 1,
      days: 2,
      travelersSummary: "성인 2명",
      styleSummary: "맛집",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "1일차",
        summary: "요약1",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "오사카성",
            area: "츄오구",
            description: "성 관람",
            estimatedDurationMinutes: 90,
            travelToNext: { mode: "walk", estimatedMinutes: 15 },
            bookingRecommended: false,
          },
        ],
        tips: ["팁"],
      },
      {
        day: 2,
        date: "2026-10-02",
        title: "2일차",
        summary: "요약2",
        items: [
          {
            order: 1,
            time: "11:00",
            type: "other",
            name: "체크아웃",
            area: null,
            description: "호텔 체크아웃",
            estimatedDurationMinutes: 30,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: {
      travelTips: ["여유"],
      packingHints: ["편한 신발"],
    },
  });
}

function memberSession(overrides?: Partial<PlannerSession>): PlannerSession {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    anonymousKey: "anon-member-linked1",
    memberId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "generated",
    input: validDraft(),
    plan: validPlan(),
    sourceProductId: null,
    createdAt: "2026-10-31T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

function request(body: unknown, id = "11111111-1111-4111-8111-111111111111") {
  return POST(
    new Request(`http://localhost/api/planner/sessions/${id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST /api/planner/sessions/[id]/edit AI Edit quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    getPlannerSessionById.mockResolvedValue(memberSession());
    generateEditedPlannerPlan.mockResolvedValue(validPlan());
    persistEditedPlannerPlan.mockResolvedValue({
      versionNumber: 2,
      updatedAt: "2026-10-31T01:00:00.000Z",
    });
    reservePlannerAiEditQuota.mockResolvedValue("reserved");
    consumePlannerAiEditQuota.mockResolvedValue("consumed");
    releasePlannerAiEditQuota.mockResolvedValue("released");
  });

  it("success path: reserve → LLM → persist → consume", async () => {
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    expect(res.status).toBe(200);
    expect(reservePlannerAiEditQuota).toHaveBeenCalledTimes(1);
    expect(generateEditedPlannerPlan).toHaveBeenCalledTimes(1);
    expect(persistEditedPlannerPlan).toHaveBeenCalledTimes(1);
    expect(consumePlannerAiEditQuota).toHaveBeenCalledWith({
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(releasePlannerAiEditQuota).not.toHaveBeenCalled();
    expect(reservePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("4th blocked: AI_EDIT_QUOTA_EXCEEDED, LLM not called", async () => {
    reservePlannerAiEditQuota.mockResolvedValue("already_consumed");
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.code).toBe("AI_EDIT_QUOTA_EXCEEDED");
    expect(json.limit).toBe(3);
    expect(typeof json.nextAvailableAt).toBe("string");
    expect(generateEditedPlannerPlan).not.toHaveBeenCalled();
    expect(consumePlannerAiEditQuota).not.toHaveBeenCalled();
  });

  it("in progress: AI_EDIT_ALREADY_IN_PROGRESS, LLM not called", async () => {
    reservePlannerAiEditQuota.mockResolvedValue("already_reserved");
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("AI_EDIT_ALREADY_IN_PROGRESS");
    expect(generateEditedPlannerPlan).not.toHaveBeenCalled();
  });

  it("LLM failure releases reservation (no consume)", async () => {
    generateEditedPlannerPlan.mockRejectedValue(new Error("provider down"));
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    expect(res.status).toBe(502);
    expect(releasePlannerAiEditQuota).toHaveBeenCalledWith({
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(consumePlannerAiEditQuota).not.toHaveBeenCalled();
  });

  it("persist failure releases reservation (no consume)", async () => {
    persistEditedPlannerPlan.mockRejectedValue(new Error("persist failed"));
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    expect(res.status).toBe(502);
    expect(releasePlannerAiEditQuota).toHaveBeenCalled();
    expect(consumePlannerAiEditQuota).not.toHaveBeenCalled();
  });

  it("saved status also reserves AI edit quota", async () => {
    getPlannerSessionById.mockResolvedValue(memberSession({ status: "saved" }));
    const res = await request({ instruction: "여유롭게 바꿔줘" });
    expect(res.status).toBe(200);
    expect(reservePlannerAiEditQuota).toHaveBeenCalled();
    expect(consumePlannerAiEditQuota).toHaveBeenCalled();
  });

  it("guest success: lock released, not consumed (no guest quota ledger)", async () => {
    getMemberSessionFromCookies.mockReturnValue(null);
    getPlannerSessionById.mockResolvedValue(
      memberSession({
        memberId: null,
        anonymousKey: "anon-key-12345678",
      }),
    );
    const res = await request({
      instruction: "여유롭게 바꿔줘",
      anonymousKey: "anon-key-12345678",
    });
    expect(res.status).toBe(200);
    expect(reservePlannerAiEditQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        enforceLimit: false,
        subject: expect.objectContaining({ subjectType: "anonymous_key" }),
      }),
    );
    expect(releasePlannerAiEditQuota).toHaveBeenCalled();
    expect(consumePlannerAiEditQuota).not.toHaveBeenCalled();
  });
});
