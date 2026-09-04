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
