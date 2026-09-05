import { z } from "zod";
import type { PlannerDraftInput } from "@/types/planner";

export const PLANNER_ITEM_TYPES = [
  "attraction",
  "food",
  "cafe",
  "shopping",
  "activity",
  "rest",
  "transport",
  "other",
] as const;

export const PLANNER_TRAVEL_MODES = [
  "walk",
  "public_transit",
  "taxi",
  "car",
  "other",
] as const;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

export const plannerPlanTravelToNextSchema = z
  .object({
    mode: z.enum(PLANNER_TRAVEL_MODES).nullable(),
    estimatedMinutes: z.number().int().positive().nullable(),
  })
  .strict()
  .nullable();

export const plannerPlanItemSchema = z
  .object({
    order: z.number().int().min(1).max(20),
    time: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않습니다.")
      .nullable(),
    type: z.enum(PLANNER_ITEM_TYPES),
    name: z.string().trim().min(1).max(80),
    area: z.string().trim().min(1).max(80).nullable(),
    description: z.string().trim().min(1).max(400),
    estimatedDurationMinutes: z.number().int().positive().max(12 * 60).nullable(),
    travelToNext: plannerPlanTravelToNextSchema,
    bookingRecommended: z.boolean(),
  })
  .strict();

export const plannerPlanDaySchema = z
  .object({
    day: z.number().int().min(1).max(30),
    date: isoDateSchema,
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    items: z.array(plannerPlanItemSchema).min(1).max(10),
    tips: z.array(z.string().trim().min(1).max(160)).max(6),
  })
  .strict()
  .superRefine((day, ctx) => {
    const orders = day.items.map((i) => i.order);
    const expected = orders.map((_, idx) => idx + 1);
    if (orders.join(",") !== expected.join(",")) {
      ctx.addIssue({
        code: "custom",
        message: "일정 항목 order는 1부터 연속이어야 합니다.",
        path: ["items"],
      });
    }
  });

export const plannerPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(400),
    destination: z
      .object({
        name: z.string().trim().min(1).max(80),
        country: z.string().trim().min(1).max(80).nullable().optional(),
      })
      .strict(),
    tripOverview: z
      .object({
        startDate: isoDateSchema,
        endDate: isoDateSchema,
        nights: z.number().int().min(0).max(60),
        days: z.number().int().min(1).max(30),
        travelersSummary: z.string().trim().min(1).max(120),
        styleSummary: z.string().trim().min(1).max(160),
      })
      .strict(),
    days: z.array(plannerPlanDaySchema).min(1).max(30),
    preparation: z
      .object({
        travelTips: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
        packingHints: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
      })
      .strict(),
  })
  .strict();

export type PlannerPlan = z.infer<typeof plannerPlanSchema>;
export type PlannerPlanDay = z.infer<typeof plannerPlanDaySchema>;
export type PlannerPlanItem = z.infer<typeof plannerPlanItemSchema>;

export function addDaysToIsoDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function expectedTripDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("Invalid trip date range");
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

export class PlannerPlanInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerPlanInvariantError";
  }
}

/** Validate AI plan against draft dates/day continuity after zod parse. */
export function assertGeneratedPlanMatchesDraft(
  plan: PlannerPlan,
  draft: PlannerDraftInput,
): void {
  const expectedDays = expectedTripDays(draft.dates.startDate, draft.dates.endDate);
  if (plan.days.length !== expectedDays) {
    throw new PlannerPlanInvariantError(
      `day count mismatch: expected ${expectedDays}, got ${plan.days.length}`,
    );
  }
  if (plan.tripOverview.days !== expectedDays) {
    throw new PlannerPlanInvariantError(
      `tripOverview.days mismatch: expected ${expectedDays}, got ${plan.tripOverview.days}`,
    );
  }
  if (plan.tripOverview.nights !== Math.max(0, expectedDays - 1)) {
    throw new PlannerPlanInvariantError(
      `tripOverview.nights mismatch: expected ${expectedDays - 1}, got ${plan.tripOverview.nights}`,
    );
  }
  if (plan.tripOverview.startDate !== draft.dates.startDate) {
    throw new PlannerPlanInvariantError("tripOverview.startDate mismatch");
  }
  if (plan.tripOverview.endDate !== draft.dates.endDate) {
    throw new PlannerPlanInvariantError("tripOverview.endDate mismatch");
  }

  for (let i = 0; i < plan.days.length; i += 1) {
    const day = plan.days[i]!;
    const expectedDate = addDaysToIsoDate(draft.dates.startDate, i);
    if (day.day !== i + 1) {
      throw new PlannerPlanInvariantError(`day index mismatch at ${i}: expected ${i + 1}`);
    }
    if (day.date !== expectedDate) {
      throw new PlannerPlanInvariantError(
        `day date mismatch at day ${day.day}: expected ${expectedDate}, got ${day.date}`,
      );
    }
  }
}
