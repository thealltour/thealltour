import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerInterest, PlannerSession } from "@/types/planner";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import { plannerManualEditBodySchema } from "@/lib/planner/manualEdit/schemas";

const getMemberSessionFromCookies = vi.hoisted(() => vi.fn());
const getPlannerSessionById = vi.hoisted(() => vi.fn());
const cookies = vi.hoisted(() => vi.fn(async () => ({})));
const generateEditedPlannerPlan = vi.hoisted(() => vi.fn());
const reservePlannerGenerationQuota = vi.hoisted(() => vi.fn());
const { persistEditedPlannerPlan, PlannerPlanVersionConflictError } = vi.hoisted(() => {
  class PlannerPlanVersionConflictError extends Error {
    constructor(message = "PLAN_VERSION_CONFLICT") {
      super(message);
      this.name = "PlannerPlanVersionConflictError";
    }
  }
  return {
    persistEditedPlannerPlan: vi.fn(),
    PlannerPlanVersionConflictError,
  };
});

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
  PlannerPlanVersionConflictError,
}));

vi.mock("@/lib/planner/generatePlan", () => ({
  generateEditedPlannerPlan,
  generatePlannerPlan: vi.fn(),
}));

vi.mock("@/lib/planner/quota/repository", () => ({
  reservePlannerGenerationQuota,
  consumePlannerGenerationQuota: vi.fn(),
  releasePlannerGenerationQuota: vi.fn(),
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

function plan(): PlannerPlan {
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
          {
            order: 2,
            time: "13:00",
            type: "food",
            name: "점심",
            area: null,
            description: "식사",
            estimatedDurationMinutes: 60,
            travelToNext: null,
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

function session(overrides: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key12",
    memberId: null,
    status: "generated",
    input: validDraft(),
    plan: plan(),
    sourceProductId: null,
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

async function callManual(body: unknown, id = "550e8400-e29b-41d4-a716-446655440000") {
  const req = new Request("http://localhost/api/planner/sessions/x/manual-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("manual-edit body schema", () => {
  it("rejects spoof plan_json / memberId", () => {
    expect(
      plannerManualEditBodySchema.safeParse({
        operation: "update_day",
        dayNumber: 1,
        patch: { title: "x" },
        expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
        plan_json: {},
        memberId: "x",
      }).success,
    ).toBe(false);
  });
});

describe("POST manual-edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemberSessionFromCookies.mockReturnValue(null);
    getPlannerSessionById.mockResolvedValue(session());
    persistEditedPlannerPlan.mockResolvedValue({
      versionNumber: 2,
      updatedAt: "2026-10-31T01:00:00.000Z",
    });
  });

  it("allows guest owner", async () => {
    const res = await callManual({
      operation: "update_day",
      dayNumber: 1,
      patch: { title: "도착일" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.plan.days[0].title).toBe("도착일");
    expect(body.session.status).toBe("generated");
    expect(body.session.updatedAt).toBe("2026-10-31T01:00:00.000Z");
    expect(persistEditedPlannerPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
        editInstruction: "[manual:update_day]",
        status: "generated",
      }),
    );
    expect(generateEditedPlannerPlan).not.toHaveBeenCalled();
    expect(reservePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("allows member owner on guest draft (anonymousKey)", async () => {
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "11111111-1111-4111-8111-111111111111",
    });
    const res = await callManual({
      operation: "update_item",
      dayNumber: 1,
      itemOrder: 1,
      patch: { time: "11:30" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(200);
  });

  it("rejects wrong anonymous owner", async () => {
    const res = await callManual({
      operation: "update_day",
      dayNumber: 1,
      patch: { title: "x" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-wrong-key-xx",
    });
    expect(res.status).toBe(403);
    expect(persistEditedPlannerPlan).not.toHaveBeenCalled();
  });

  it("rejects draft status", async () => {
    getPlannerSessionById.mockResolvedValue(session({ status: "draft", plan: null }));
    const res = await callManual({
      operation: "update_day",
      dayNumber: 1,
      patch: { title: "x" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(409);
  });

  it("allows saved and preserves saved status", async () => {
    getPlannerSessionById.mockResolvedValue(session({ status: "saved" }));
    const res = await callManual({
      operation: "add_item",
      dayNumber: 1,
      item: { name: "카페" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.status).toBe("saved");
    expect(persistEditedPlannerPlan).toHaveBeenCalledWith(
      expect.objectContaining({ status: "saved", editInstruction: "[manual:add_item]" }),
    );
  });

  it("returns 409 PLAN_VERSION_CONFLICT on stale expectedUpdatedAt", async () => {
    persistEditedPlannerPlan.mockRejectedValue(new PlannerPlanVersionConflictError());
    const res = await callManual({
      operation: "update_day",
      dayNumber: 1,
      patch: { title: "충돌" },
      expectedUpdatedAt: "2026-10-30T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PLAN_VERSION_CONFLICT");
  });

  it("rejects last item delete", async () => {
    const res = await callManual({
      operation: "delete_item",
      dayNumber: 2,
      itemOrder: 1,
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      anonymousKey: "anon-correct-key12",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("LAST_DAY_ITEM_CANNOT_BE_DELETED");
    expect(persistEditedPlannerPlan).not.toHaveBeenCalled();
  });
});
