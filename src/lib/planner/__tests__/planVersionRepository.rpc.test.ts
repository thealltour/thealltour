import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    rpc,
  },
}));

import {
  persistEditedPlannerPlan,
  PlannerPlanPersistError,
  PlannerPlanVersionConflictError,
} from "@/lib/planner/planVersionRepository";
import { plannerPlanSchema, type PlannerPlan } from "@/lib/planner/planSchemas";

function plan(title = "오사카"): PlannerPlan {
  return plannerPlanSchema.parse({
    title,
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
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  });
}

describe("persistEditedPlannerPlan RPC wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps updated outcome", async () => {
    rpc.mockResolvedValue({
      data: {
        outcome: "updated",
        version_number: 2,
        updated_at: "2026-10-31T01:00:00.000Z",
        status: "generated",
      },
      error: null,
    });

    const next = plan("수정");
    const result = await persistEditedPlannerPlan({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      previousPlan: plan(),
      nextPlan: next,
      editInstruction: "[manual:update_day]",
      status: "generated",
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
    });

    expect(result).toEqual({
      versionNumber: 2,
      updatedAt: "2026-10-31T01:00:00.000Z",
    });
    expect(rpc).toHaveBeenCalledWith(
      "persist_planner_plan_edit",
      expect.objectContaining({
        p_session_id: "550e8400-e29b-41d4-a716-446655440000",
        p_next_plan: next,
        p_edit_instruction: "[manual:update_day]",
        p_status: "generated",
        p_expected_updated_at: "2026-10-31T00:00:00.000Z",
      }),
    );
  });

  it("maps conflict → PlannerPlanVersionConflictError (Manual)", async () => {
    rpc.mockResolvedValue({
      data: { outcome: "conflict", updated_at: "2026-10-31T00:30:00.000Z" },
      error: null,
    });
    await expect(
      persistEditedPlannerPlan({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        previousPlan: plan(),
        nextPlan: plan("x"),
        editInstruction: "[manual:update_item]",
        status: "generated",
        expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(PlannerPlanVersionConflictError);
  });

  it("AI path passes null expectedUpdatedAt", async () => {
    rpc.mockResolvedValue({
      data: {
        outcome: "updated",
        version_number: 3,
        updated_at: "2026-10-31T02:00:00.000Z",
        status: "saved",
      },
      error: null,
    });
    await persistEditedPlannerPlan({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      previousPlan: plan(),
      nextPlan: plan("ai"),
      editInstruction: "맛집 더",
      status: "saved",
    });
    expect(rpc).toHaveBeenCalledWith(
      "persist_planner_plan_edit",
      expect.objectContaining({
        p_expected_updated_at: null,
        p_status: "saved",
      }),
    );
  });

  it("maps invalid_status → PlannerPlanPersistError", async () => {
    rpc.mockResolvedValue({
      data: { outcome: "invalid_status", status: "draft" },
      error: null,
    });
    await expect(
      persistEditedPlannerPlan({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        previousPlan: plan(),
        nextPlan: plan("x"),
        editInstruction: "x",
        status: "generated",
      }),
    ).rejects.toMatchObject({ code: "invalid_status" } satisfies Partial<PlannerPlanPersistError>);
  });
});
