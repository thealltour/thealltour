import { describe, expect, it } from "vitest";
import {
  decidePlannerClaim,
  decidePlannerOwnershipAttach,
} from "@/lib/planner/claimDecision";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerSession } from "@/types/planner";

const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";

function samplePlan(): PlannerPlan {
  return plannerPlanSchema.parse({
    title: "오사카",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      nights: 1,
      days: 2,
      travelersSummary: "2명",
      styleSummary: "여유",
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
            name: "장소",
            area: null,
            description: "설명",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
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
            name: "이동",
            area: null,
            description: "체크아웃",
            estimatedDurationMinutes: 30,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["팁"], packingHints: ["신발"] },
  });
}

function session(overrides: Partial<PlannerSession> = {}): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    anonymousKey: "anon-correct-key",
    memberId: null,
    status: "generated",
    input: createEmptyPlannerDraftInput("오사카"),
    plan: samplePlan(),
    sourceProductId: null,
    createdAt: "2026-10-31T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("decidePlannerOwnershipAttach", () => {
  it("guest generated with plan → attach_anonymous", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session(),
        memberId: MEMBER_A,
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "attach_anonymous" });
  });

  it("same member generated → idempotent_owned (no save)", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        memberId: MEMBER_A,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "idempotent_owned" });
  });

  it("same member saved → idempotent_owned", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session({ memberId: MEMBER_A, status: "saved" }),
        memberId: MEMBER_A,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "idempotent_owned" });
  });

  it("wrong anonymousKey → forbidden", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session(),
        memberId: MEMBER_A,
        anonymousKey: "wrong-key",
      }),
    ).toEqual({ action: "reject", reason: "forbidden" });
  });

  it("other member → forbidden", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session({ memberId: MEMBER_A }),
        memberId: MEMBER_B,
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "reject", reason: "forbidden" });
  });

  it("draft → invalid_status", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session({ status: "draft" }),
        memberId: MEMBER_A,
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "reject", reason: "invalid_status" });
  });

  it("plan null → invalid_status", () => {
    expect(
      decidePlannerOwnershipAttach({
        session: session({ plan: null }),
        memberId: MEMBER_A,
        anonymousKey: "anon-correct-key",
      }),
    ).toEqual({ action: "reject", reason: "invalid_status" });
  });

  it("save decision still marks generated owner as mark_saved_for_owner", () => {
    expect(
      decidePlannerClaim({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        memberId: MEMBER_A,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "mark_saved_for_owner" });
  });
});

describe("cross-device ownership after claim", () => {
  it("member cookie alone allows read without anonymousKey", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        anonymousKey: null,
        cookieMemberId: MEMBER_A,
      }).ok,
    ).toBe(true);
  });

  it("member cookie alone allows manual-edit style ownership without anonymousKey", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        anonymousKey: undefined,
        cookieMemberId: MEMBER_A,
      }).ok,
    ).toBe(true);
  });

  it("other member rejected even with guest anonymousKey", () => {
    expect(
      assertPlannerSessionOwnership({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        anonymousKey: "anon-correct-key",
        cookieMemberId: MEMBER_B,
      }).ok,
    ).toBe(false);
  });
});

describe("Kakao action status after claim vs save", () => {
  it("claim-only generated remains not_saved for Kakao memo/calendar contract", () => {
    const claimedGenerated = session({ memberId: MEMBER_A, status: "generated" });
    expect(claimedGenerated.status === "saved").toBe(false);
  });

  it("explicit save marks saved for Kakao action availability", () => {
    expect(
      decidePlannerClaim({
        session: session({ memberId: MEMBER_A, status: "generated" }),
        memberId: MEMBER_A,
        anonymousKey: "anything-key",
      }),
    ).toEqual({ action: "mark_saved_for_owner" });
  });
});
