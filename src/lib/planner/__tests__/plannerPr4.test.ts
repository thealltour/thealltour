import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { decidePlannerClaim } from "@/lib/planner/claimDecision";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import {
  PLANNER_SAVE_INTENT_STORAGE_KEY,
  PLANNER_SAVE_INTENT_TTL_MS,
  clearPlannerSaveIntent,
  consumeMatchingPlannerSaveIntent,
  readPlannerSaveIntent,
  setPlannerSaveIntent,
} from "@/lib/planner/saveIntent";
import type { PlannerSession } from "@/types/planner";

const saveBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
  })
  .strict();

const readBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

function session(overrides: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key",
    memberId: null,
    status: "generated",
    input: createEmptyPlannerDraftInput("오사카"),
    plan: null,
    sourceProductId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PR-4 planner save contracts", () => {
  it("rejects client-supplied memberId / status / plan_json on save body", () => {
    expect(
      saveBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        memberId: "spoof",
      }).success,
    ).toBe(false);
    expect(
      saveBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        status: "saved",
      }).success,
    ).toBe(false);
    expect(
      saveBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        plan_json: {},
      }).success,
    ).toBe(false);
    expect(saveBodySchema.safeParse({ anonymousKey: "anon-key-12345678" }).success).toBe(true);
  });

  it("allows read without anonymousKey (member cookie path)", () => {
    expect(readBodySchema.safeParse({}).success).toBe(true);
    expect(readBodySchema.safeParse({ anonymousKey: "anon-key-12345678" }).success).toBe(true);
  });

  it("member-owned session allows access without matching anonymousKey", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId, status: "saved" }),
        anonymousKey: "different-browser-key",
        cookieMemberId: memberId,
      }).ok,
    ).toBe(true);
  });

  it("member-owned session denies other member even with correct anonymousKey", () => {
    const r = assertPlannerSessionOwnership({
      session: session({
        memberId: "11111111-1111-4111-8111-111111111111",
        status: "saved",
      }),
      anonymousKey: "anon-correct-key",
      cookieMemberId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.ok).toBe(false);
  });

  it("anonymous session still requires matching key", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session(),
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session: session(),
        anonymousKey: "wrong-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(false);
  });

  it("anonymous session denies when anonymousKey omitted", () => {
    const r = assertPlannerSessionOwnership({
      session: session(),
      anonymousKey: null,
      cookieMemberId: null,
    });
    expect(r.ok).toBe(false);
  });

  it("claim: anonymous generated + correct key → claim_anonymous", () => {
    expect(
      decidePlannerClaim({
        session: session({ status: "generated", memberId: null }),
        memberId: "11111111-1111-4111-8111-111111111111",
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "claim_anonymous" });
  });

  it("claim: wrong anonymousKey → forbidden", () => {
    expect(
      decidePlannerClaim({
        session: session({ status: "generated" }),
        memberId: "11111111-1111-4111-8111-111111111111",
        anonymousKey: "wrong",
      }),
    ).toEqual({ action: "reject", reason: "forbidden" });
  });

  it("claim: draft → invalid_status", () => {
    expect(
      decidePlannerClaim({
        session: session({ status: "draft" }),
        memberId: "11111111-1111-4111-8111-111111111111",
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "reject", reason: "invalid_status" });
  });

  it("claim: other member → forbidden", () => {
    expect(
      decidePlannerClaim({
        session: session({
          memberId: "11111111-1111-4111-8111-111111111111",
          status: "saved",
        }),
        memberId: "22222222-2222-4222-8222-222222222222",
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "reject", reason: "forbidden" });
  });

  it("claim: same member saved → idempotent", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    expect(
      decidePlannerClaim({
        session: session({ memberId, status: "saved" }),
        memberId,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "idempotent_saved" });
  });

  it("claim: same member generated → mark_saved_for_owner", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    expect(
      decidePlannerClaim({
        session: session({ memberId, status: "generated" }),
        memberId,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "mark_saved_for_owner" });
  });

  it("sanitizeNextPath allows /planner/{id} and blocks open redirects", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(sanitizeNextPath(`/planner/${id}`)).toBe(`/planner/${id}`);
    expect(sanitizeNextPath("https://evil.example.com")).toBe("/");
    expect(sanitizeNextPath("//evil.example.com")).toBe("/");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("registers planner save analytics event names", () => {
    expect(ANALYTICS_EVENTS.planner_save_clicked).toBe("planner_save_clicked");
    expect(ANALYTICS_EVENTS.planner_kakao_login_started).toBe("planner_kakao_login_started");
    expect(ANALYTICS_EVENTS.planner_saved).toBe("planner_saved");
  });
});

describe("planner save intent", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and reads intent for matching session", () => {
    setPlannerSaveIntent("550e8400-e29b-41d4-a716-446655440000");
    const intent = consumeMatchingPlannerSaveIntent("550e8400-e29b-41d4-a716-446655440000");
    expect(intent?.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("does not match different sessionId", () => {
    setPlannerSaveIntent("550e8400-e29b-41d4-a716-446655440000");
    expect(consumeMatchingPlannerSaveIntent("660e8400-e29b-41d4-a716-446655440000")).toBeNull();
    expect(readPlannerSaveIntent()?.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("expires after TTL", () => {
    const past = Date.now() - PLANNER_SAVE_INTENT_TTL_MS - 1000;
    store.set(
      PLANNER_SAVE_INTENT_STORAGE_KEY,
      JSON.stringify({ sessionId: "550e8400-e29b-41d4-a716-446655440000", createdAt: past }),
    );
    expect(readPlannerSaveIntent()).toBeNull();
  });

  it("clear removes intent", () => {
    setPlannerSaveIntent("550e8400-e29b-41d4-a716-446655440000");
    clearPlannerSaveIntent();
    expect(readPlannerSaveIntent()).toBeNull();
  });
});
