import type { PlannerPlanItem } from "@/lib/planner/planSchemas";

export const PLANNER_MANUAL_OPERATIONS = [
  "update_day",
  "update_item",
  "add_item",
  "delete_item",
  "move_item",
] as const;

export type PlannerManualOperation = (typeof PLANNER_MANUAL_OPERATIONS)[number];

export type PlannerManualEditErrorCode =
  | "INVALID_DAY"
  | "INVALID_ITEM"
  | "LAST_DAY_ITEM_CANNOT_BE_DELETED"
  | "DAY_ITEMS_FULL"
  | "INVALID_ORDER"
  | "EMPTY_PATCH"
  | "VALIDATION";

export class PlannerManualEditError extends Error {
  readonly code: PlannerManualEditErrorCode;

  constructor(code: PlannerManualEditErrorCode, message: string) {
    super(message);
    this.name = "PlannerManualEditError";
    this.code = code;
  }
}

export type UpdateDayCommand = {
  operation: "update_day";
  dayNumber: number;
  patch: { title?: string };
  expectedUpdatedAt: string;
};

export type UpdateItemCommand = {
  operation: "update_item";
  dayNumber: number;
  itemOrder: number;
  patch: {
    time?: string | null;
    name?: string;
    area?: string | null;
    description?: string;
    type?: PlannerPlanItem["type"];
    estimatedDurationMinutes?: number | null;
  };
  expectedUpdatedAt: string;
};

export type AddItemCommand = {
  operation: "add_item";
  dayNumber: number;
  item: {
    name: string;
    time?: string | null;
    description?: string;
    type?: PlannerPlanItem["type"];
    area?: string | null;
    estimatedDurationMinutes?: number | null;
  };
  insertAtOrder?: number;
  expectedUpdatedAt: string;
};

export type DeleteItemCommand = {
  operation: "delete_item";
  dayNumber: number;
  itemOrder: number;
  expectedUpdatedAt: string;
};

export type MoveItemCommand = {
  operation: "move_item";
  dayNumber: number;
  itemOrder: number;
  toOrder: number;
  expectedUpdatedAt: string;
};

export type PlannerManualCommand =
  | UpdateDayCommand
  | UpdateItemCommand
  | AddItemCommand
  | DeleteItemCommand
  | MoveItemCommand;

export function manualEditInstructionLabel(operation: PlannerManualOperation): string {
  return `[manual:${operation}]`;
}
