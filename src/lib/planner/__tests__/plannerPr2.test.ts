import { describe, expect, it } from "vitest";
import {
  createPlannerSessionBodySchema,
  plannerDraftInputSchema,
  updatePlannerSessionBodySchema,
  validatePlannerStep,
} from "@/lib/planner/schemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PlannerSession } from "@/types/planner";

function validDraft() {
  return {
    ...createEmptyPlannerDraftInput("오사카"),
    dates: {
      mode: "fixed" as const,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    },
    travelers: { adults: 2, children: 1 },
    companionType: "family" as const,
    interests: ["food", "sightseeing"] as const,
    pace: "balanced" as const,
    budget: {
      style: null,
      amount: 1_500_000,
      scope: "per_person" as const,
      currency: "KRW" as const,
    },
    additionalRequest: "천천히 다니고 싶어요",
  };
}

describe("plannerDraftInputSchema", () => {
  it("accepts a complete valid draft", () => {
    const parsed = plannerDraftInputSchema.parse(validDraft());
    expect(parsed.destination.text).toBe("오사카");
    expect(parsed.interests).toEqual(["food", "sightseeing"]);
  });

  it("rejects endDate before startDate", () => {
    const draft = validDraft();
    draft.dates = {
      mode: "fixed",
      startDate: "2026-10-05",
      endDate: "2026-10-01",
      durationDays: 3,
    };
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects adults < 1", () => {
    const draft = validDraft();
    draft.travelers = { adults: 0, children: 0 };
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects invalid companion", () => {
    const draft = { ...validDraft(), companionType: "coworker" };
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects invalid interest", () => {
    const draft = { ...validDraft(), interests: ["golf"] };
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects negative budget", () => {
    const draft = validDraft();
    draft.budget = { style: null, amount: -1, scope: "total", currency: "KRW" };
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects additionalRequest over 1000 chars", () => {
    const draft = validDraft();
    draft.additionalRequest = "가".repeat(1001);
    expect(plannerDraftInputSchema.safeParse(draft).success).toBe(false);
  });

  it("dedupes interests", () => {
    const draft = { ...validDraft(), interests: ["food", "food", "nature"] };
    const parsed = plannerDraftInputSchema.parse(draft);
    expect(parsed.interests).toEqual(["food", "nature"]);
  });
});

describe("validatePlannerStep", () => {
  it("requires interests on step 4", () => {
    const draft = createEmptyPlannerDraftInput("제주");
    expect(validatePlannerStep(4, draft)).toMatch(/취향/);
  });

  it("allows empty additionalRequest on step 6", () => {
    const draft = createEmptyPlannerDraftInput("제주");
    expect(validatePlannerStep(6, draft)).toBeNull();
  });
});

describe("updatePlannerSessionBodySchema", () => {
  it("rejects client memberId spoof", () => {
    const result = updatePlannerSessionBodySchema.safeParse({
      anonymousKey: "anon-key-12345678",
      input: createEmptyPlannerDraftInput("다낭"),
      memberId: "spoof",
    });
    expect(result.success).toBe(false);
  });

  it("requires full draft when finalize=true", () => {
    const result = updatePlannerSessionBodySchema.safeParse({
      anonymousKey: "anon-key-12345678",
      input: createEmptyPlannerDraftInput("다낭"),
      finalize: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts finalize with complete draft", () => {
    const result = updatePlannerSessionBodySchema.safeParse({
      anonymousKey: "anon-key-12345678",
      input: validDraft(),
      finalize: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("assertPlannerSessionOwnership", () => {
  const base: PlannerSession = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key",
    memberId: null,
    status: "draft",
    input: createEmptyPlannerDraftInput("오사카"),
    plan: null,
    sourceProductId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("allows anonymous with matching key", () => {
    expect(
      assertPlannerSessionOwnership({
        session: base,
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
  });

  it("denies anonymous with wrong key", () => {
    const r = assertPlannerSessionOwnership({
      session: base,
      anonymousKey: "anon-wrong-key",
      cookieMemberId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("allows member with matching cookie member id", () => {
    const session = { ...base, memberId: "11111111-1111-4111-8111-111111111111" };
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: "anon-correct-key",
        cookieMemberId: "11111111-1111-4111-8111-111111111111",
      }).ok,
    ).toBe(true);
  });

  it("allows member owner even when anonymousKey differs (cross-device)", () => {
    const session = { ...base, memberId: "11111111-1111-4111-8111-111111111111", status: "saved" as const };
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: "other-device-key",
        cookieMemberId: "11111111-1111-4111-8111-111111111111",
      }).ok,
    ).toBe(true);
  });

  it("denies member mismatch", () => {
    const session = { ...base, memberId: "11111111-1111-4111-8111-111111111111" };
    const r = assertPlannerSessionOwnership({
      session,
      anonymousKey: "anon-correct-key",
      cookieMemberId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("returns 404 when session missing", () => {
    const r = assertPlannerSessionOwnership({
      session: null,
      anonymousKey: "anon-correct-key",
      cookieMemberId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });
});

describe("create session + analytics", () => {
  it("keeps sourceProductId on create body", () => {
    const parsed = createPlannerSessionBodySchema.parse({
      anonymousKey: "anon-key-12345678",
      destination: "파리",
      sourceProductId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(parsed.sourceProductId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("registers planner_input_completed", () => {
    expect(ANALYTICS_EVENTS.planner_input_completed).toBe("planner_input_completed");
  });
});
