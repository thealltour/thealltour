import { describe, expect, it } from "vitest";
import {
  applyPlannerManualCommand,
  MANUAL_ADD_ITEM_DEFAULT_DESCRIPTION,
} from "@/lib/planner/manualEdit/applyPlannerManualCommand";
import { PlannerManualEditError } from "@/lib/planner/manualEdit/types";
import { plannerPlanSchema, type PlannerPlan, type PlannerPlanItem } from "@/lib/planner/planSchemas";

function item(over: Partial<PlannerPlanItem> & Pick<PlannerPlanItem, "order" | "name">): PlannerPlanItem {
  return {
    time: "10:00",
    type: "attraction",
    area: "난바",
    description: "설명",
    estimatedDurationMinutes: 60,
    travelToNext: { mode: "walk", estimatedMinutes: 10 },
    bookingRecommended: true,
    ...over,
  };
}

function basePlan(itemCount = 3): PlannerPlan {
  const items = Array.from({ length: itemCount }, (_, i) =>
    item({
      order: i + 1,
      name: `장소${i + 1}`,
      time: `${10 + i}:00`.padStart(5, "0"),
    }),
  );
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
        title: "1일차 제목",
        summary: "1일차 요약",
        items,
        tips: ["팁"],
      },
      {
        day: 2,
        date: "2026-10-02",
        title: "2일차 제목",
        summary: "2일차 요약",
        items: [item({ order: 1, name: "귀국 준비" })],
        tips: [],
      },
    ],
    preparation: {
      travelTips: ["여유 있게"],
      packingHints: ["편한 신발"],
    },
  });
}

describe("applyPlannerManualCommand update_day", () => {
  it("updates day title", () => {
    const next = applyPlannerManualCommand(basePlan(), {
      operation: "update_day",
      dayNumber: 1,
      patch: { title: "도착과 적응" },
      expectedUpdatedAt: "2026-10-31T00:00:00.000Z",
    });
    expect(next.days[0]!.title).toBe("도착과 적응");
    expect(plannerPlanSchema.safeParse(next).success).toBe(true);
  });

  it("rejects missing day", () => {
    expect(() =>
      applyPlannerManualCommand(basePlan(), {
        operation: "update_day",
        dayNumber: 9,
        patch: { title: "x" },
        expectedUpdatedAt: "t",
      }),
    ).toThrow(PlannerManualEditError);
  });
});

describe("applyPlannerManualCommand update_item", () => {
  it("patches time/name/area/description/type/duration", () => {
    const next = applyPlannerManualCommand(basePlan(), {
      operation: "update_item",
      dayNumber: 1,
      itemOrder: 2,
      patch: {
        time: "14:30",
        name: "도톤보리",
        area: "츄오구",
        description: "야경 산책",
        type: "shopping",
        estimatedDurationMinutes: 90,
      },
      expectedUpdatedAt: "t",
    });
    const target = next.days[0]!.items[1]!;
    expect(target).toMatchObject({
      order: 2,
      time: "14:30",
      name: "도톤보리",
      area: "츄오구",
      description: "야경 산책",
      type: "shopping",
      estimatedDurationMinutes: 90,
      bookingRecommended: false,
    });
  });

  it("clears neighbor travelToNext when name/area changes", () => {
    const next = applyPlannerManualCommand(basePlan(3), {
      operation: "update_item",
      dayNumber: 1,
      itemOrder: 2,
      patch: { name: "새장소" },
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items[0]!.travelToNext).toBeNull();
    expect(next.days[0]!.items[1]!.travelToNext).toBeNull();
    // item 3 (index 2) not neighbor of cleared set? neighbors of index 1 are 0 and 1
    expect(next.days[0]!.items[2]!.travelToNext).not.toBeNull();
  });

  it("keeps bookingRecommended when only time changes", () => {
    const next = applyPlannerManualCommand(basePlan(), {
      operation: "update_item",
      dayNumber: 1,
      itemOrder: 1,
      patch: { time: "11:00" },
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items[0]!.bookingRecommended).toBe(true);
    expect(next.days[0]!.items[0]!.travelToNext).not.toBeNull();
  });
});

describe("applyPlannerManualCommand add_item", () => {
  it("appends with defaults and renumbers", () => {
    const next = applyPlannerManualCommand(basePlan(2), {
      operation: "add_item",
      dayNumber: 1,
      item: { name: "새 일정" },
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items).toHaveLength(3);
    const added = next.days[0]!.items[2]!;
    expect(added).toMatchObject({
      order: 3,
      name: "새 일정",
      type: "other",
      description: MANUAL_ADD_ITEM_DEFAULT_DESCRIPTION,
      area: null,
      estimatedDurationMinutes: null,
      travelToNext: null,
      bookingRecommended: false,
    });
    expect(next.days[0]!.items.map((i) => i.order)).toEqual([1, 2, 3]);
  });

  it("rejects when day already has 10 items", () => {
    try {
      applyPlannerManualCommand(basePlan(10), {
        operation: "add_item",
        dayNumber: 1,
        item: { name: "overflow" },
        expectedUpdatedAt: "t",
      });
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlannerManualEditError);
      expect((error as PlannerManualEditError).code).toBe("DAY_ITEMS_FULL");
    }
  });
});

describe("applyPlannerManualCommand delete_item", () => {
  it("renumbers after delete and clears neighbors", () => {
    const next = applyPlannerManualCommand(basePlan(3), {
      operation: "delete_item",
      dayNumber: 1,
      itemOrder: 2,
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items.map((i) => i.name)).toEqual(["장소1", "장소3"]);
    expect(next.days[0]!.items.map((i) => i.order)).toEqual([1, 2]);
  });

  it("rejects last item", () => {
    try {
      applyPlannerManualCommand(basePlan(1), {
        operation: "delete_item",
        dayNumber: 1,
        itemOrder: 1,
        expectedUpdatedAt: "t",
      });
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlannerManualEditError);
      expect((error as PlannerManualEditError).code).toBe("LAST_DAY_ITEM_CANNOT_BE_DELETED");
    }
  });
});

describe("applyPlannerManualCommand move_item", () => {
  it("moves down and clears all travel", () => {
    const next = applyPlannerManualCommand(basePlan(3), {
      operation: "move_item",
      dayNumber: 1,
      itemOrder: 1,
      toOrder: 3,
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items.map((i) => i.name)).toEqual(["장소2", "장소3", "장소1"]);
    expect(next.days[0]!.items.every((i) => i.travelToNext === null)).toBe(true);
    expect(next.days[0]!.items.map((i) => i.order)).toEqual([1, 2, 3]);
  });

  it("moves up", () => {
    const next = applyPlannerManualCommand(basePlan(3), {
      operation: "move_item",
      dayNumber: 1,
      itemOrder: 3,
      toOrder: 1,
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items.map((i) => i.name)).toEqual(["장소3", "장소1", "장소2"]);
  });

  it("same order is no-op", () => {
    const plan = basePlan(2);
    const next = applyPlannerManualCommand(plan, {
      operation: "move_item",
      dayNumber: 1,
      itemOrder: 1,
      toOrder: 1,
      expectedUpdatedAt: "t",
    });
    expect(next.days[0]!.items[0]!.travelToNext).not.toBeNull();
  });

  it("rejects invalid toOrder", () => {
    try {
      applyPlannerManualCommand(basePlan(2), {
        operation: "move_item",
        dayNumber: 1,
        itemOrder: 1,
        toOrder: 9,
        expectedUpdatedAt: "t",
      });
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PlannerManualEditError);
      expect((error as PlannerManualEditError).code).toBe("INVALID_ORDER");
    }
  });
});
