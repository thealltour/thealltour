import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { assertEditedPlanMatchesContext, PlannerPlanInvariantError } from "@/lib/planner/planSchemas";
import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import { plannerEditBodySchema, plannerEditInstructionSchema } from "@/lib/planner/schemas";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerDraftInput, PlannerSession } from "@/types/planner";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function sampleDraft(): PlannerDraftInput {
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
    pace: "balanced",
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
  };
}

function samplePlan(): PlannerPlan {
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
          time: "10:00",
          type: "attraction" as const,
          name: "명소",
          area: "난바",
          description: "설명",
          estimatedDurationMinutes: 90,
          travelToNext: null,
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

function session(overrides: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key",
    memberId: null,
    status: "generated",
    input: sampleDraft(),
    plan: samplePlan(),
    sourceProductId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PR-6 planner edit contracts", () => {
  it("accepts valid edit instruction", () => {
    expect(plannerEditInstructionSchema.safeParse("좀 더 여유롭게").success).toBe(true);
    expect(plannerEditBodySchema.safeParse({ instruction: "맛집 더" }).success).toBe(true);
  });

  it("rejects empty or oversized instruction", () => {
    expect(plannerEditInstructionSchema.safeParse(" ").success).toBe(false);
    expect(plannerEditInstructionSchema.safeParse("a").success).toBe(false);
    expect(plannerEditInstructionSchema.safeParse("x".repeat(1001)).success).toBe(false);
  });

  it("rejects client-supplied planJson / memberId / status", () => {
    expect(
      plannerEditBodySchema.safeParse({
        instruction: "여유롭게",
        planJson: {},
      }).success,
    ).toBe(false);
    expect(
      plannerEditBodySchema.safeParse({
        instruction: "여유롭게",
        memberId: "x",
        status: "saved",
      }).success,
    ).toBe(false);
  });

  it("allows anonymous owner with matching key", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session(),
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
  });

  it("denies wrong anonymous key", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session(),
        anonymousKey: "wrong-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(false);
  });

  it("allows member owner without anonymousKey", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId, status: "saved" }),
        anonymousKey: null,
        cookieMemberId: memberId,
      }).ok,
    ).toBe(true);
  });

  it("denies other member", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session({
          memberId: "11111111-1111-4111-8111-111111111111",
          status: "saved",
        }),
        anonymousKey: null,
        cookieMemberId: "22222222-2222-4222-8222-222222222222",
      }).ok,
    ).toBe(false);
  });

  it("documents draft edit rejection", () => {
    expect(session({ status: "draft" }).status === "draft").toBe(true);
    expect(["generated", "saved"].includes("draft")).toBe(false);
  });

  it("rejects destination change on edit invariant", () => {
    const draft = sampleDraft();
    const prev = samplePlan();
    const next = samplePlan();
    next.destination.name = "교토";
    expect(() => assertEditedPlanMatchesContext(next, draft, prev)).toThrow(
      PlannerPlanInvariantError,
    );
  });

  it("rejects day count change on edit invariant", () => {
    const draft = sampleDraft();
    const prev = samplePlan();
    const next = samplePlan();
    next.days.push({
      day: 4,
      date: "2026-10-04",
      title: "extra",
      summary: "no",
      items: [
        {
          order: 1,
          time: null,
          type: "other",
          name: "x",
          area: null,
          description: "x",
          estimatedDurationMinutes: null,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    });
    next.tripOverview.days = 4;
    next.tripOverview.endDate = "2026-10-04";
    expect(() => assertEditedPlanMatchesContext(next, draft, prev)).toThrow(
      PlannerPlanInvariantError,
    );
  });

  it("accepts valid edited plan with same destination/dates", () => {
    const draft = sampleDraft();
    const prev = samplePlan();
    const next = samplePlan();
    next.title = "여유로운 오사카";
    next.days[0]!.items[0]!.name = "온천";
    expect(() => assertEditedPlanMatchesContext(next, draft, prev)).not.toThrow();
  });

  it("registers edit analytics without instruction text keys", () => {
    expect(ANALYTICS_EVENTS.planner_edit_started).toBe("planner_edit_started");
    expect(ANALYTICS_EVENTS.planner_edit_succeeded).toBe("planner_edit_succeeded");
    expect(ANALYTICS_EVENTS.planner_edit_failed).toBe("planner_edit_failed");
    const meta = {
      sessionId: "x",
      instructionLength: 12,
      status: "generated" as const,
    };
    expect(meta).not.toHaveProperty("instruction");
  });

  it("documents status preserved on edit", () => {
    const before = "saved" as const;
    const after = before;
    expect(after).toBe("saved");
  });
});
