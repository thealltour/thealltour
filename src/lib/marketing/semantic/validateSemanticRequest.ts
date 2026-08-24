import { z } from "zod";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import { isUuid } from "@/lib/marketing/context/validation";
import type {
  ParsedSemanticRetrievalRequest,
  SemanticRetrievalRequest,
} from "@/lib/marketing/semantic/types";

export const DEFAULT_SEMANTIC_LIMIT = 10;
export const MAX_SEMANTIC_LIMIT = 50;

const semanticRequestSchema = z
  .object({
    query: z.string().trim().min(1, "query is required"),
    limit: z.number().optional(),
    minScore: z.number().optional(),
    memoryTypes: z.array(z.string().trim().min(1)).optional(),
    sourceTypes: z.array(z.string().trim().min(1)).optional(),
    productId: z.string().trim().optional(),
    campaignId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    for (const field of ["productId", "campaignId"] as const) {
      const id = value[field];
      if (id && !isUuid(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a UUID`,
          path: [field],
        });
      }
    }
    if (value.minScore != null && (value.minScore < 0 || value.minScore > 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minScore must be between 0 and 1",
        path: ["minScore"],
      });
    }
  });

export function clampSemanticLimit(limit?: number): number {
  if (limit == null || Number.isNaN(limit)) return DEFAULT_SEMANTIC_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new ContextValidationError("limit must be a positive number");
  }
  return Math.min(Math.floor(limit), MAX_SEMANTIC_LIMIT);
}

export function parseSemanticRetrievalRequest(
  input: SemanticRetrievalRequest,
): ParsedSemanticRetrievalRequest {
  const parsed = semanticRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid semantic retrieval request";
    throw new ContextValidationError(first);
  }
  return {
    ...parsed.data,
    query: parsed.data.query,
    limit: clampSemanticLimit(parsed.data.limit),
  };
}
