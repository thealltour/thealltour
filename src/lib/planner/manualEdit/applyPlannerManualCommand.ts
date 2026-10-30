import {
  plannerPlanSchema,
  type PlannerPlan,
  type PlannerPlanDay,
  type PlannerPlanItem,
} from "@/lib/planner/planSchemas";
import {
  PlannerManualEditError,
  type PlannerManualCommand,
} from "@/lib/planner/manualEdit/types";

export const MANUAL_ADD_ITEM_DEFAULT_DESCRIPTION = "직접 추가한 일정입니다.";
const MAX_ITEMS_PER_DAY = 10;

function clonePlan(plan: PlannerPlan): PlannerPlan {
  return structuredClone(plan);
}

function findDayIndex(plan: PlannerPlan, dayNumber: number): number {
  return plan.days.findIndex((d) => d.day === dayNumber);
}

function requireDay(plan: PlannerPlan, dayNumber: number): { index: number; day: PlannerPlanDay } {
  const index = findDayIndex(plan, dayNumber);
  if (index < 0) {
    throw new PlannerManualEditError("INVALID_DAY", "해당 일자 일정을 찾을 수 없습니다.");
  }
  return { index, day: plan.days[index]! };
}

function requireItemIndex(day: PlannerPlanDay, itemOrder: number): number {
  const index = day.items.findIndex((item) => item.order === itemOrder);
  if (index < 0) {
    throw new PlannerManualEditError("INVALID_ITEM", "해당 일정을 찾을 수 없습니다.");
  }
  return index;
}

function normalizeItemOrders(items: PlannerPlanItem[]): PlannerPlanItem[] {
  return items.map((item, idx) => ({ ...item, order: idx + 1 }));
}

function clearTravelToNext(item: PlannerPlanItem): PlannerPlanItem {
  return { ...item, travelToNext: null };
}

function clearAllTravel(day: PlannerPlanDay): PlannerPlanDay {
  return {
    ...day,
    items: day.items.map(clearTravelToNext),
  };
}

function clearNeighborTravel(items: PlannerPlanItem[], affectedIndexes: number[]): PlannerPlanItem[] {
  const clear = new Set<number>();
  for (const idx of affectedIndexes) {
    if (idx >= 0 && idx < items.length) clear.add(idx);
    if (idx - 1 >= 0) clear.add(idx - 1);
  }
  return items.map((item, idx) => (clear.has(idx) ? clearTravelToNext(item) : item));
}

function applyUpdateDay(plan: PlannerPlan, command: Extract<PlannerManualCommand, { operation: "update_day" }>): PlannerPlan {
  const next = clonePlan(plan);
  const { index, day } = requireDay(next, command.dayNumber);
  if (command.patch.title === undefined) {
    throw new PlannerManualEditError("EMPTY_PATCH", "수정할 내용이 없습니다.");
  }
  next.days[index] = { ...day, title: command.patch.title.trim() };
  return next;
}

function applyUpdateItem(
  plan: PlannerPlan,
  command: Extract<PlannerManualCommand, { operation: "update_item" }>,
): PlannerPlan {
  const next = clonePlan(plan);
  const { index: dayIndex, day } = requireDay(next, command.dayNumber);
  const itemIndex = requireItemIndex(day, command.itemOrder);
  const current = day.items[itemIndex]!;
  const patch = command.patch;

  const updated: PlannerPlanItem = { ...current };
  if (patch.time !== undefined) updated.time = patch.time;
  if (patch.name !== undefined) updated.name = patch.name.trim();
  if (patch.area !== undefined) {
    updated.area = patch.area === null ? null : patch.area.trim();
  }
  if (patch.description !== undefined) updated.description = patch.description.trim();
  if (patch.type !== undefined) updated.type = patch.type;
  if (patch.estimatedDurationMinutes !== undefined) {
    updated.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  }

  const placeChanged =
    (patch.name !== undefined && patch.name.trim() !== current.name) ||
    (patch.area !== undefined &&
      (patch.area === null ? null : patch.area.trim()) !== current.area);

  if (placeChanged) {
    updated.bookingRecommended = false;
  }

  const items = [...day.items];
  items[itemIndex] = updated;
  const withTravel = placeChanged
    ? clearNeighborTravel(items, [itemIndex])
    : items;

  next.days[dayIndex] = {
    ...day,
    items: normalizeItemOrders(withTravel),
  };
  return next;
}

function applyAddItem(
  plan: PlannerPlan,
  command: Extract<PlannerManualCommand, { operation: "add_item" }>,
): PlannerPlan {
  const next = clonePlan(plan);
  const { index: dayIndex, day } = requireDay(next, command.dayNumber);
  if (day.items.length >= MAX_ITEMS_PER_DAY) {
    throw new PlannerManualEditError(
      "DAY_ITEMS_FULL",
      "하루 일정은 최대 10개까지 추가할 수 있습니다.",
    );
  }

  const newItem: PlannerPlanItem = {
    order: day.items.length + 1,
    time: command.item.time ?? null,
    type: command.item.type ?? "other",
    name: command.item.name.trim(),
    area: command.item.area === undefined ? null : command.item.area,
    description: (command.item.description?.trim() || MANUAL_ADD_ITEM_DEFAULT_DESCRIPTION).slice(
      0,
      400,
    ),
    estimatedDurationMinutes: command.item.estimatedDurationMinutes ?? null,
    travelToNext: null,
    bookingRecommended: false,
  };

  const items = [...day.items];
  const insertAt =
    command.insertAtOrder == null
      ? items.length
      : Math.max(0, Math.min(items.length, command.insertAtOrder - 1));

  items.splice(insertAt, 0, newItem);
  const withTravel = clearNeighborTravel(items, [insertAt === 0 ? 0 : insertAt - 1, insertAt]);

  next.days[dayIndex] = {
    ...day,
    items: normalizeItemOrders(withTravel),
  };
  return next;
}

function applyDeleteItem(
  plan: PlannerPlan,
  command: Extract<PlannerManualCommand, { operation: "delete_item" }>,
): PlannerPlan {
  const next = clonePlan(plan);
  const { index: dayIndex, day } = requireDay(next, command.dayNumber);
  if (day.items.length <= 1) {
    throw new PlannerManualEditError(
      "LAST_DAY_ITEM_CANNOT_BE_DELETED",
      "하루에는 최소 1개의 일정이 필요합니다.",
    );
  }
  const itemIndex = requireItemIndex(day, command.itemOrder);
  const items = [...day.items];
  items.splice(itemIndex, 1);
  const withTravel = clearNeighborTravel(items, [itemIndex - 1, itemIndex]);
  next.days[dayIndex] = {
    ...day,
    items: normalizeItemOrders(withTravel),
  };
  return next;
}

function applyMoveItem(
  plan: PlannerPlan,
  command: Extract<PlannerManualCommand, { operation: "move_item" }>,
): PlannerPlan {
  const next = clonePlan(plan);
  const { index: dayIndex, day } = requireDay(next, command.dayNumber);
  const fromIndex = requireItemIndex(day, command.itemOrder);
  const toOrder = command.toOrder;
  if (toOrder < 1 || toOrder > day.items.length) {
    throw new PlannerManualEditError("INVALID_ORDER", "이동할 위치가 올바르지 않습니다.");
  }
  if (command.itemOrder === toOrder) {
    return next;
  }

  const items = [...day.items];
  const [moved] = items.splice(fromIndex, 1);
  if (!moved) {
    throw new PlannerManualEditError("INVALID_ITEM", "해당 일정을 찾을 수 없습니다.");
  }
  const insertAt = Math.max(0, Math.min(items.length, toOrder - 1));
  items.splice(insertAt, 0, moved);

  next.days[dayIndex] = clearAllTravel({
    ...day,
    items: normalizeItemOrders(items),
  });
  return next;
}

/**
 * Pure planner manual-edit applicator. No LLM / DB.
 * Always returns a plan that passes plannerPlanSchema (or throws).
 */
export function applyPlannerManualCommand(
  plan: PlannerPlan,
  command: PlannerManualCommand,
): PlannerPlan {
  let next: PlannerPlan;
  switch (command.operation) {
    case "update_day":
      next = applyUpdateDay(plan, command);
      break;
    case "update_item":
      next = applyUpdateItem(plan, command);
      break;
    case "add_item":
      next = applyAddItem(plan, command);
      break;
    case "delete_item":
      next = applyDeleteItem(plan, command);
      break;
    case "move_item":
      next = applyMoveItem(plan, command);
      break;
    default: {
      const _exhaustive: never = command;
      void _exhaustive;
      throw new PlannerManualEditError("VALIDATION", "지원하지 않는 수정 요청입니다.");
    }
  }

  const parsed = plannerPlanSchema.safeParse(next);
  if (!parsed.success) {
    throw new PlannerManualEditError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "일정 형식이 올바르지 않습니다.",
    );
  }
  return parsed.data;
}
