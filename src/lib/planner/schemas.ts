import { z } from "zod";

export const PLANNER_SESSION_STATUSES = ["draft", "generated", "saved"] as const;

export const plannerSessionStatusSchema = z.enum(PLANNER_SESSION_STATUSES);

/** Opaque UUID-like anonymous key from the browser (not PII). */
export const plannerAnonymousKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "invalid anonymousKey");

export const plannerDestinationSchema = z
  .string()
  .trim()
  .min(1, "목적지를 입력해 주세요.")
  .max(120, "목적지는 120자 이내로 입력해 주세요.");

export const createPlannerSessionBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema,
    destination: plannerDestinationSchema,
    sourceProductId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type CreatePlannerSessionBody = z.infer<typeof createPlannerSessionBodySchema>;
