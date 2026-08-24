import { z } from "zod";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import {
  DEFAULT_LOOKBACK_DAYS,
  MAX_LOOKBACK_DAYS,
  isUuid,
} from "@/lib/marketing/context/validation";
import {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  PERIOD_REQUIRED_SOURCES,
} from "@/lib/marketing/retrieval/constants";
import type {
  MarketingRetrievalRequest,
  ParsedMarketingRetrievalRequest,
  RetrievalPlan,
} from "@/lib/marketing/retrieval/types";

const isoDateSchema = z.string().min(1);

const retrievalRequestSchema = z
  .object({
    purpose: z.string().trim().min(1),
    productId: z.string().trim().optional(),
    campaignId: z.string().trim().optional(),
    agendaId: z.string().trim().optional(),
    taxonomyId: z.string().trim().optional(),
    channel: z.string().trim().min(1).optional(),
    lookbackDays: z.number().int().optional(),
    startAt: isoDateSchema.optional(),
    endAt: isoDateSchema.optional(),
    periodStart: isoDateSchema.optional(),
    periodEnd: isoDateSchema.optional(),
    limit: z.number().optional(),
    includeProduct: z.boolean().optional(),
    includeCustomerInsights: z.boolean().optional(),
    includeBookings: z.boolean().optional(),
    includeReviews: z.boolean().optional(),
    includeContentHistory: z.boolean().optional(),
    includePublications: z.boolean().optional(),
    includePerformance: z.boolean().optional(),
    includeMemory: z.boolean().optional(),
    includeAgendas: z.boolean().optional(),
    contentId: z.string().trim().optional(),
    bookingStatus: z.string().trim().min(1).optional(),
    acquisitionChannel: z.string().trim().min(1).optional(),
    publicationStatus: z.string().trim().min(1).optional(),
    memoryType: z.string().trim().min(1).optional(),
    sourceType: z.string().trim().min(1).optional(),
    sourceId: z.string().trim().optional(),
    minImportance: z.number().optional(),
    minConfidence: z.number().optional(),
    excludeExpired: z.boolean().optional(),
    activeOnly: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    for (const field of ["productId", "campaignId", "agendaId", "taxonomyId", "contentId"] as const) {
      const id = value[field];
      if (id && !isUuid(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a UUID`,
          path: [field],
        });
      }
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
  });

export const PURPOSE_ALIASES: Record<string, string> = {
  create_content: "create_content",
  content_generation: "create_content",
  analyze_performance: "analyze_performance",
  governance_check: "governance_check",
  trend_analysis: "trend_analysis",
  campaign_planning: "campaign_planning",
};

export function canonicalPurpose(purpose: string): string {
  return PURPOSE_ALIASES[purpose] ?? purpose;
}

export function clampRetrievalLimit(limit?: number): number {
  if (limit == null || Number.isNaN(limit)) return DEFAULT_RETRIEVAL_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new ContextValidationError("limit must be a positive number");
  }
  return Math.min(Math.floor(limit), MAX_RETRIEVAL_LIMIT);
}

export function resolveRetrievalPeriod(
  input: {
    lookbackDays?: number;
    startAt?: string;
    endAt?: string;
    periodStart?: string;
    periodEnd?: string;
    now?: Date;
  },
  options?: { required?: boolean },
): { start: string; end: string } | null {
  const startAt = input.startAt ?? input.periodStart;
  const endAt = input.endAt ?? input.periodEnd;
  const hasLookback = input.lookbackDays != null;
  const hasExplicit = Boolean(startAt || endAt);

  if (!hasLookback && !hasExplicit) {
    if (options?.required) {
      throw new ContextValidationError("startAt/endAt or lookbackDays is required");
    }
    return null;
  }

  if (input.lookbackDays != null && input.lookbackDays < 0) {
    throw new ContextValidationError("lookbackDays must not be negative");
  }
  if (input.lookbackDays != null && input.lookbackDays > MAX_LOOKBACK_DAYS) {
    throw new ContextValidationError(`lookbackDays must be <= ${MAX_LOOKBACK_DAYS}`);
  }

  const now = input.now ?? new Date();
  const end = endAt ?? now.toISOString();
  if (startAt) {
    if (startAt > end) {
      throw new ContextValidationError("startAt must be <= endAt");
    }
    return { start: startAt, end };
  }

  const days = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const startDate = new Date(end);
  if (Number.isNaN(startDate.getTime())) {
    throw new ContextValidationError("endAt is not a valid date");
  }
  startDate.setUTCDate(startDate.getUTCDate() - days);
  return { start: startDate.toISOString(), end };
}

export function withComposePeriodDefaults(
  request: MarketingRetrievalRequest,
): MarketingRetrievalRequest {
  const hasPeriod = Boolean(
    request.startAt ||
      request.endAt ||
      request.periodStart ||
      request.periodEnd ||
      request.lookbackDays != null,
  );
  if (hasPeriod) return request;
  return { ...request, lookbackDays: DEFAULT_LOOKBACK_DAYS };
}

export function parseMarketingRetrievalRequest(
  input: MarketingRetrievalRequest,
): ParsedMarketingRetrievalRequest {
  const parsed = retrievalRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid marketing retrieval request";
    throw new ContextValidationError(first);
  }
  const data = parsed.data;
  return {
    ...data,
    purpose: data.purpose,
    canonicalPurpose: canonicalPurpose(data.purpose),
    limit: clampRetrievalLimit(data.limit),
    excludeExpired: data.excludeExpired ?? true,
    activeOnly: data.activeOnly ?? false,
    period: resolveRetrievalPeriod(data),
  };
}

export function requireRetrievalPeriod(
  request: ParsedMarketingRetrievalRequest,
): { start: string; end: string } {
  if (request.period) return request.period;
  throw new ContextValidationError("startAt/endAt or lookbackDays is required");
}

export function assertPlanPeriod(
  request: ParsedMarketingRetrievalRequest,
  plan: RetrievalPlan,
): void {
  const needsPeriod = plan.sources.some((source) =>
    (PERIOD_REQUIRED_SOURCES as readonly string[]).includes(source),
  );
  if (needsPeriod && !request.period) {
    throw new ContextValidationError("startAt/endAt or lookbackDays is required for this purpose");
  }
}
