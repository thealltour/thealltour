import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerInterest, PlannerSession } from "@/types/planner";

const getMemberSessionFromCookies = vi.hoisted(() => vi.fn());
const getPlannerSessionById = vi.hoisted(() => vi.fn());
const generatePlannerPlan = vi.hoisted(() => vi.fn());
const saveGeneratedPlannerPlan = vi.hoisted(() => vi.fn());
const reservePlannerGenerationQuota = vi.hoisted(() => vi.fn());
const consumePlannerGenerationQuota = vi.hoisted(() => vi.fn());
const releasePlannerGenerationQuota = vi.hoisted(() => vi.fn());
const persistAnalyticsEventAdmin = vi.hoisted(() => vi.fn(async () => undefined));
const cookies = vi.hoisted(() => vi.fn(async () => ({})));

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
  saveGeneratedPlannerPlan,
}));

vi.mock("@/lib/planner/generatePlan", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planner/generatePlan")>(
    "@/lib/planner/generatePlan",
  );
  return {
    ...actual,
    generatePlannerPlan,
  };
});

vi.mock("@/lib/planner/quota/repository", () => ({
  reservePlannerGenerationQuota,
  consumePlannerGenerationQuota,
  releasePlannerGenerationQuota,
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
      endDate: "2026-10-03",
      durationDays: 3,
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

function session(overrides: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key12",
    memberId: null,
    status: "draft",
    input: validDraft(),
    plan: null,
    sourceProductId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function planPayload() {
  return {
    title: "오사카 3일",
    summary: "요약",
    days: [{ day: 1, title: "D1", items: [{ name: "도톤보리", type: "spot" }] }],
  };
}

async function callGenerate(params?: {
  anonymousKey?: string;
  id?: string;
}) {
  const req = new Request("http://localhost/api/planner/sessions/x/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anonymousKey: params?.anonymousKey ?? "anon-correct-key12",
    }),
  });
  return POST(req, {
    params: Promise.resolve({ id: params?.id ?? "550e8400-e29b-41d4-a716-446655440000" }),
  });
}

describe("POST generate quota wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemberSessionFromCookies.mockReturnValue(null);
    getPlannerSessionById.mockResolvedValue(session());
    generatePlannerPlan.mockResolvedValue({
      plan: planPayload(),
      meta: { semanticAttempts: 1, provider: "openai", modelId: "m" },
    });
    saveGeneratedPlannerPlan.mockImplementation(async ({ id, plan }: { id: string; plan: unknown }) =>
      session({
        id,
        status: "generated",
        plan: plan as PlannerSession["plan"],
      }),
    );
    reservePlannerGenerationQuota.mockResolvedValue("reserved");
    consumePlannerGenerationQuota.mockResolvedValue("consumed");
    releasePlannerGenerationQuota.mockResolvedValue("released");
  });

  it("guest first generation success + consume", async () => {
    const res = await callGenerate();
    expect(res.status).toBe(200);
    expect(reservePlannerGenerationQuota).toHaveBeenCalledTimes(1);
    expect(generatePlannerPlan).toHaveBeenCalledTimes(1);
    expect(saveGeneratedPlannerPlan).toHaveBeenCalledTimes(1);
    expect(consumePlannerGenerationQuota).toHaveBeenCalledWith({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(releasePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("guest second new session: ANONYMOUS_LIFETIME_QUOTA_EXCEEDED", async () => {
    reservePlannerGenerationQuota.mockResolvedValue("already_consumed");
    const res = await callGenerate();
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("ANONYMOUS_LIFETIME_QUOTA_EXCEEDED");
    expect(generatePlannerPlan).not.toHaveBeenCalled();
    expect(consumePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("member first generation success", async () => {
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "11111111-1111-4111-8111-111111111111",
    });
    // Option A: guest draft ownership via anonymousKey even when logged in
    getPlannerSessionById.mockResolvedValue(session({ memberId: null }));
    const res = await callGenerate();
    expect(res.status).toBe(200);
    expect(reservePlannerGenerationQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.objectContaining({
          subjectType: "member",
          subjectId: "11111111-1111-4111-8111-111111111111",
          windowType: "kst_day",
        }),
      }),
    );
    expect(consumePlannerGenerationQuota).toHaveBeenCalled();
  });

  it("member second new session same KST day: AI_DAILY_QUOTA_EXCEEDED", async () => {
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "11111111-1111-4111-8111-111111111111",
    });
    reservePlannerGenerationQuota.mockResolvedValue("already_consumed");
    const res = await callGenerate();
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("AI_DAILY_QUOTA_EXCEEDED");
    expect(typeof body.nextAvailableAt).toBe("string");
    expect(generatePlannerPlan).not.toHaveBeenCalled();
  });

  it("member next day: allowed (reserve passes)", async () => {
    getMemberSessionFromCookies.mockReturnValue({
      memberId: "11111111-1111-4111-8111-111111111111",
    });
    reservePlannerGenerationQuota.mockResolvedValue("reserved");
    const res = await callGenerate();
    expect(res.status).toBe(200);
    expect(generatePlannerPlan).toHaveBeenCalled();
  });

  it("generation provider failure: release", async () => {
    const { PlannerGenerateError } = await import("@/lib/planner/generatePlan");
    generatePlannerPlan.mockRejectedValue(
      new PlannerGenerateError("timeout", "boom", "provider_failed", {
        stage: "provider_call",
      }),
    );
    const res = await callGenerate();
    expect(res.status).toBe(502);
    expect(releasePlannerGenerationQuota).toHaveBeenCalledWith({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(consumePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("persist failure: release", async () => {
    saveGeneratedPlannerPlan.mockRejectedValue(new Error("db down"));
    const res = await callGenerate();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.failureCategory).toBe("persist_failed");
    expect(releasePlannerGenerationQuota).toHaveBeenCalled();
    expect(consumePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("already generated session reused: quota skipped", async () => {
    getPlannerSessionById.mockResolvedValue(
      session({
        status: "generated",
        plan: planPayload() as PlannerSession["plan"],
      }),
    );
    const res = await callGenerate();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(reservePlannerGenerationQuota).not.toHaveBeenCalled();
    expect(generatePlannerPlan).not.toHaveBeenCalled();
    expect(consumePlannerGenerationQuota).not.toHaveBeenCalled();
  });

  it("concurrent sessions: LLM call once (second reserve blocked)", async () => {
    let reserveCalls = 0;
    reservePlannerGenerationQuota.mockImplementation(async () => {
      reserveCalls += 1;
      return reserveCalls === 1 ? "reserved" : "already_reserved";
    });

    const [a, b] = await Promise.all([callGenerate(), callGenerate()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(generatePlannerPlan).toHaveBeenCalledTimes(1);
    const blocked = a.status === 409 ? a : b;
    const body = await blocked.json();
    expect(body.code).toBe("GENERATION_ALREADY_IN_PROGRESS");
  });
});
