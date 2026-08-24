import { z } from "zod";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import type { MarketingContextRequest } from "@/lib/marketing/context/types";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_LOOKBACK_DAYS = 30;
export const MAX_LOOKBACK_DAYS = 365;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

const isoDateSchema = z.string().min(1);

export const marketingContextRequestSchema = z
  .object({
    purpose: z.string().trim().min(1),
    productId: z.string().trim().optional(),
    campaignId: z.string().trim().optional(),
    channel: z.string().trim().min(1).optional(),
    lookbackDays: z.number().int().optional(),
    periodStart: isoDateSchema.optional(),
    periodEnd: isoDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.productId && !isUuid(value.productId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productId must be a UUID",
        path: ["productId"],
      });
    }
    if (value.campaignId && !isUuid(value.campaignId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "campaignId must be a UUID",
        path: ["campaignId"],
      });
    }
    if (value.lookbackDays != null && value.lookbackDays < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lookbackDays must not be negative",
        path: ["lookbackDays"],
      });
    }
    if (value.lookbackDays != null && value.lookbackDays > MAX_LOOKBACK_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `lookbackDays must be <= ${MAX_LOOKBACK_DAYS}`,
        path: ["lookbackDays"],
      });
    }
    if (value.periodStart && value.periodEnd && value.periodStart > value.periodEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "periodStart must be <= periodEnd",
        path: ["periodStart"],
      });
    }
  });

export function parseMarketingContextRequest(
  input: MarketingContextRequest,
): MarketingContextRequest {
  const parsed = marketingContextRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid marketing context request";
    throw new ContextValidationError(first);
  }
  return parsed.data;
}

export function requireUuid(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new ContextValidationError(`${fieldName} must be a UUID`);
  }
  return trimmed;
}

export function resolvePeriod(input: {
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
  now?: Date;
}): { start: string; end: string } {
  if (input.lookbackDays != null && input.lookbackDays < 0) {
    throw new ContextValidationError("lookbackDays must not be negative");
  }
  if (input.lookbackDays != null && input.lookbackDays > MAX_LOOKBACK_DAYS) {
    throw new ContextValidationError(`lookbackDays must be <= ${MAX_LOOKBACK_DAYS}`);
  }
  if (input.periodStart && input.periodEnd && input.periodStart > input.periodEnd) {
    throw new ContextValidationError("periodStart must be <= periodEnd");
  }

  const now = input.now ?? new Date();
  const end = input.periodEnd ?? now.toISOString();
  if (input.periodStart) {
    return { start: input.periodStart, end };
  }
  const days = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const startDate = new Date(end);
  if (Number.isNaN(startDate.getTime())) {
    throw new ContextValidationError("periodEnd is not a valid date");
  }
  startDate.setUTCDate(startDate.getUTCDate() - days);
  return { start: startDate.toISOString(), end };
}
