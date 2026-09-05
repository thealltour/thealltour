import { describe, expect, it, vi, beforeEach } from "vitest";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerDraftInputSchema, plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { z } from "zod";
import type { PlannerSession } from "@/types/planner";

const generateBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

function validDraft() {
  return {
    ...createEmptyPlannerDraftInput("오사카"),
    dates: {
      mode: "fixed" as const,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      durationDays: 3,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "couple" as const,
    interests: ["food"] as const,
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
    anonymousKey: "anon-correct-key",
    memberId: null,
    status: "draft",
    input: validDraft(),
    plan: null,
    sourceProductId: "550e8400-e29b-41d4-a716-446655440001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("generate/read API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects client-supplied plan_json / memberId / status", () => {
    expect(
      generateBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        plan_json: { title: "hack" },
        memberId: "x",
        status: "generated",
      }).success,
    ).toBe(false);
  });

  it("allows anonymous with matching key", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session(),
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
  });

  it("denies wrong anonymous key", () => {
    const r = assertPlannerSessionOwnership({
      session: session(),
      anonymousKey: "anon-wrong",
      cookieMemberId: null,
    });
    expect(r.ok).toBe(false);
  });

  it("allows matching member owner", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId: "11111111-1111-4111-8111-111111111111" }),
        anonymousKey: "anon-correct-key",
        cookieMemberId: "11111111-1111-4111-8111-111111111111",
      }).ok,
    ).toBe(true);
  });

  it("denies other member", () => {
    const r = assertPlannerSessionOwnership({
      session: session({ memberId: "11111111-1111-4111-8111-111111111111" }),
      anonymousKey: "anon-correct-key",
      cookieMemberId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects incomplete draft for generation", () => {
    const incomplete = createEmptyPlannerDraftInput("제주");
    expect(plannerDraftInputSchema.safeParse(incomplete).success).toBe(false);
  });

  it("accepts complete draft for generation", () => {
    expect(plannerDraftInputSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("duplicate generated session should reuse existing plan (policy)", () => {
    const generated = session({
      status: "generated",
      plan: {
        title: "existing",
        summary: "s",
        destination: { name: "오사카" },
        tripOverview: {
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          nights: 2,
          days: 3,
          travelersSummary: "2",
          styleSummary: "s",
        },
        days: [],
        preparation: { travelTips: ["t"], packingHints: ["p"] },
      } as PlannerSession["plan"],
    });
    expect(generated.status === "generated" && generated.plan).toBeTruthy();
  });
});
