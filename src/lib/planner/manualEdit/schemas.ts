import { z } from "zod";
import { PLANNER_ITEM_TYPES } from "@/lib/planner/planSchemas";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";

const expectedUpdatedAtSchema = z
  .string()
  .trim()
  .min(1, "expectedUpdatedAt is required.")
  .refine((v) => Number.isFinite(Date.parse(v)), "expectedUpdatedAt must be a valid ISO timestamp.");

const dayNumberSchema = z.number().int().min(1).max(30);
const itemOrderSchema = z.number().int().min(1).max(20);

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않습니다.")
  .nullable();

const titlePatchSchema = z.string().trim().min(1).max(80);

const updateDaySchema = z
  .object({
    operation: z.literal("update_day"),
    dayNumber: dayNumberSchema,
    patch: z
      .object({
        title: titlePatchSchema.optional(),
      })
      .strict()
      .refine((p) => p.title !== undefined, { message: "수정할 내용이 없습니다." }),
    expectedUpdatedAt: expectedUpdatedAtSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const updateItemSchema = z
  .object({
    operation: z.literal("update_item"),
    dayNumber: dayNumberSchema,
    itemOrder: itemOrderSchema,
    patch: z
      .object({
        time: timeSchema.optional(),
        name: z.string().trim().min(1).max(80).optional(),
        area: z.string().trim().min(1).max(80).nullable().optional(),
        description: z.string().trim().min(1).max(400).optional(),
        type: z.enum(PLANNER_ITEM_TYPES).optional(),
        estimatedDurationMinutes: z.number().int().positive().max(12 * 60).nullable().optional(),
      })
      .strict()
      .refine(
        (p) =>
          p.time !== undefined ||
          p.name !== undefined ||
          p.area !== undefined ||
          p.description !== undefined ||
          p.type !== undefined ||
          p.estimatedDurationMinutes !== undefined,
        { message: "수정할 내용이 없습니다." },
      ),
    expectedUpdatedAt: expectedUpdatedAtSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const addItemSchema = z
  .object({
    operation: z.literal("add_item"),
    dayNumber: dayNumberSchema,
    item: z
      .object({
        name: z.string().trim().min(1).max(80),
        time: timeSchema.optional(),
        description: z.string().trim().min(1).max(400).optional(),
        type: z.enum(PLANNER_ITEM_TYPES).optional(),
        area: z.string().trim().min(1).max(80).nullable().optional(),
        estimatedDurationMinutes: z.number().int().positive().max(12 * 60).nullable().optional(),
      })
      .strict(),
    insertAtOrder: itemOrderSchema.optional(),
    expectedUpdatedAt: expectedUpdatedAtSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const deleteItemSchema = z
  .object({
    operation: z.literal("delete_item"),
    dayNumber: dayNumberSchema,
    itemOrder: itemOrderSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

const moveItemSchema = z
  .object({
    operation: z.literal("move_item"),
    dayNumber: dayNumberSchema,
    itemOrder: itemOrderSchema,
    toOrder: itemOrderSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

export const plannerManualEditBodySchema = z.discriminatedUnion("operation", [
  updateDaySchema,
  updateItemSchema,
  addItemSchema,
  deleteItemSchema,
  moveItemSchema,
]);

export type PlannerManualEditBody = z.infer<typeof plannerManualEditBodySchema>;
