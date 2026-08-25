import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import type {
  ProductReviewSummaryRow,
  ReviewJoinRow,
} from "@/lib/marketing/context/mappers/reviewInsightMapper";
import { mapReviewInsight } from "@/lib/marketing/context/mappers/reviewInsightMapper";
import { isUuid, requireUuid, resolvePeriod } from "@/lib/marketing/context/validation";
import {
  REVIEW_MEMORY_DEFAULT_LIMIT,
  REVIEW_MEMORY_MAX_LIMIT,
  REVIEW_MEMORY_SOURCE_NAME,
} from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { mapReviewInsightToMemoryDocument } from "@/lib/marketing/memory/reviewMemoryContent";
import type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";

export type ReviewMemoryLoadParams = {
  productId?: string;
  productIds?: string[];
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  minReviewCount?: number;
};

export type ParsedReviewMemoryLoadParams = {
  ids: string[];
  limit: number;
  minReviewCount: number;
  period: { start: string; end: string } | null;
};

export type ReviewMemoryBundle = {
  productId: string;
  productTitle: string | null;
  summary: ProductReviewSummaryRow | null;
  reviews: ReviewJoinRow[];
};

export type ReviewMemorySourceDeps = {
  loadBundles?: (params: ParsedReviewMemoryLoadParams) => Promise<ReviewMemoryBundle[]>;
};

export function parseReviewMemoryLoadParams(params: ReviewMemoryLoadParams = {}): ParsedReviewMemoryLoadParams {
  const limit = params.limit ?? REVIEW_MEMORY_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > REVIEW_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`limit must be an integer between 1 and ${REVIEW_MEMORY_MAX_LIMIT}`);
  }
  const minReviewCount = params.minReviewCount ?? 1;
  if (!Number.isInteger(minReviewCount) || minReviewCount < 0) {
    throw new MemoryValidationError("minReviewCount must be a non-negative integer");
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const pushId = (value: string, field: string) => {
    const id = requireUuid(value, field);
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (params.productId) pushId(params.productId, "productId");
  for (const value of params.productIds ?? []) {
    if (typeof value !== "string" || !isUuid(value)) {
      throw new ContextValidationError("productIds must be UUIDs");
    }
    pushId(value, "productIds");
  }
  if (ids.length === 0) {
    throw new MemoryValidationError("productId or productIds is required");
  }
  if (ids.length > REVIEW_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`productIds exceed REVIEW_MEMORY_MAX_LIMIT (${REVIEW_MEMORY_MAX_LIMIT})`);
  }

  const hasPeriod =
    params.lookbackDays != null ||
    Boolean(params.periodStart?.trim()) ||
    Boolean(params.periodEnd?.trim());
  const period = hasPeriod
    ? resolvePeriod({
        lookbackDays: params.lookbackDays,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      })
    : null;

  return {
    ids,
    limit,
    minReviewCount,
    period,
  };
}

export class ReviewMemorySource implements MemoryIngestionSource<ReviewMemoryLoadParams> {
  readonly name = REVIEW_MEMORY_SOURCE_NAME;

  constructor(private readonly deps: ReviewMemorySourceDeps = {}) {}

  async load(params: ReviewMemoryLoadParams = {}): Promise<MemoryDocument[]> {
    const parsed = parseReviewMemoryLoadParams(params);
    const bundles = await this.loadBundles(parsed);
    const documents: MemoryDocument[] = [];
    for (const bundle of bundles.slice(0, parsed.limit)) {
      const insight = mapReviewInsight({ summary: bundle.summary, reviews: bundle.reviews });
      if (insight.reviewCount < parsed.minReviewCount) continue;
      const document = mapReviewInsightToMemoryDocument({
        productId: bundle.productId,
        productTitle: bundle.productTitle,
        insight,
      });
      if (document) documents.push(document);
    }
    return documents;
  }

  private async loadBundles(parsed: ParsedReviewMemoryLoadParams): Promise<ReviewMemoryBundle[]> {
    if (this.deps.loadBundles) return this.deps.loadBundles(parsed);
    const { loadReviewMemoryBundles } = await import("@/lib/marketing/memory/reviewMemoryLoad");
    return loadReviewMemoryBundles(parsed);
  }
}

export function createReviewMemorySource(deps: ReviewMemorySourceDeps = {}): ReviewMemorySource {
  return new ReviewMemorySource(deps);
}
