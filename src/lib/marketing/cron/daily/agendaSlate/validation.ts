import { z } from "zod";

export const agendaSlateActionSchema = z.object({
  action: z.enum(["select_today", "defer", "reject", "reset_available"]),
  businessDateKst: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const agendaSlateProductionRequestSchema = z.object({
  businessDateKst: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  slateItemIds: z.array(z.string().min(1).max(80)).max(3).optional(),
});

export const agendaSlateRetryProductionSchema = z
  .object({
    businessDateKst: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    slateItemId: z.string().min(1).max(80).optional(),
    logicalRunKey: z.string().min(1).max(240).optional(),
  })
  .refine((value) => Boolean(value.slateItemId?.trim() || value.logicalRunKey?.trim()), {
    message: "slateItemId or logicalRunKey required",
  });

export const agendaSlateSelectStorySchema = z
  .object({
    businessDateKst: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    slateItemId: z.string().min(1).max(80).optional(),
    logicalRunKey: z.string().min(1).max(240).optional(),
    storyPointId: z.string().min(1).max(120),
  })
  .refine((value) => Boolean(value.slateItemId?.trim() || value.logicalRunKey?.trim()), {
    message: "slateItemId or logicalRunKey required",
  });

export const agendaSlateImportExternalStorySchema = z.object({
  businessDateKst: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  rawJson: z.string().min(2).max(200_000),
  dryRun: z.boolean().optional(),
});
