import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import type { AiFeedbackRow } from "@/lib/marketing/context/mappers/performanceMapper";
import { MAX_LOOKBACK_DAYS, isUuid, requireUuid, resolvePeriod } from "@/lib/marketing/context/validation";
import {
  PERFORMANCE_MEMORY_DEFAULT_LIMIT,
  PERFORMANCE_MEMORY_DEFAULT_LOOKBACK_DAYS,
  PERFORMANCE_MEMORY_DEFAULT_MIN_EVENT_COUNT,
  PERFORMANCE_MEMORY_MAX_LIMIT,
  PERFORMANCE_MEMORY_SOURCE_NAME,
} from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import {
  mapPerformanceToMemoryDocument,
  performanceChannelKey,
  performanceSignalCount,
  performanceWindowKey,
} from "@/lib/marketing/memory/performanceMemoryContent";
import type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";

export type PerformanceMemoryLoadParams = {
  productId?: string;
  productIds?: string[];
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
  minEventCount?: number;
  limit?: number;
  now?: Date;
};

export type ParsedPerformanceMemoryLoadParams = {
  ids: string[];
  channel: string | null;
  limit: number;
  minEventCount: number;
  lookbackDays: number;
  explicitRange: boolean;
  period: { start: string; end: string };
  windowKey: string;
  now: Date;
};

export type PerformanceMemoryBundle = {
  productId: string;
  productTitle: string | null;
  channel: string | null;
  publicationCount: number;
  threadPostCount: number;
  inquiryCount: number;
  bookingCount: number;
  analyticsEventCount: number;
  feedback: AiFeedbackRow[];
  publicationContentIds: Record<string, string>;
  contentTitles: Record<string, string>;
};

export type PerformanceMemorySourceDeps = {
  loadBundles?: (params: ParsedPerformanceMemoryLoadParams) => Promise<PerformanceMemoryBundle[]>;
};

export function parsePerformanceMemoryLoadParams(
  params: PerformanceMemoryLoadParams = {},
): ParsedPerformanceMemoryLoadParams {
  const limit = params.limit ?? PERFORMANCE_MEMORY_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > PERFORMANCE_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`limit must be an integer between 1 and ${PERFORMANCE_MEMORY_MAX_LIMIT}`);
  }
  const minEventCount = params.minEventCount ?? PERFORMANCE_MEMORY_DEFAULT_MIN_EVENT_COUNT;
  if (!Number.isInteger(minEventCount) || minEventCount < 0) {
    throw new MemoryValidationError("minEventCount must be a non-negative integer");
  }
  const lookbackDays = params.lookbackDays ?? PERFORMANCE_MEMORY_DEFAULT_LOOKBACK_DAYS;
  if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > MAX_LOOKBACK_DAYS) {
    throw new MemoryValidationError(`lookbackDays must be an integer between 1 and ${MAX_LOOKBACK_DAYS}`);
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
  if (ids.length > PERFORMANCE_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`productIds exceed PERFORMANCE_MEMORY_MAX_LIMIT (${PERFORMANCE_MEMORY_MAX_LIMIT})`);
  }

  const channel = params.channel?.trim() ? performanceChannelKey(params.channel) : null;
  if (channel === "all") {
    throw new MemoryValidationError("channel all is reserved; omit channel for aggregate");
  }
  const explicitRange = Boolean(params.periodStart?.trim()) || Boolean(params.periodEnd?.trim());
  const now = params.now ?? new Date();
  const period = resolvePeriod({
    lookbackDays: explicitRange ? undefined : lookbackDays,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    now,
  });
  const windowKey = performanceWindowKey({
    lookbackDays,
    explicitRange,
    periodStart: period.start,
    periodEnd: period.end,
  });

  return {
    ids,
    channel,
    limit,
    minEventCount,
    lookbackDays,
    explicitRange,
    period,
    windowKey,
    now,
  };
}

export class PerformanceMemorySource implements MemoryIngestionSource<PerformanceMemoryLoadParams> {
  readonly name = PERFORMANCE_MEMORY_SOURCE_NAME;

  constructor(private readonly deps: PerformanceMemorySourceDeps = {}) {}

  async load(params: PerformanceMemoryLoadParams = {}): Promise<MemoryDocument[]> {
    const parsed = parsePerformanceMemoryLoadParams(params);
    const bundles = await this.loadBundles(parsed);
    const window = {
      key: parsed.windowKey,
      lookbackDays: parsed.lookbackDays,
      explicitRange: parsed.explicitRange,
      period: parsed.period,
    };
    const documents: MemoryDocument[] = [];
    for (const bundle of bundles.slice(0, parsed.limit)) {
      const signalCount = performanceSignalCount({
        publicationCount: bundle.publicationCount,
        threadPostCount: bundle.threadPostCount,
        feedbackPublicationCount: new Set(
          bundle.feedback
            .map((row) => (typeof row.publication_id === "string" ? row.publication_id : null))
            .filter((id): id is string => Boolean(id)),
        ).size,
        inquiryCount: bundle.inquiryCount,
        bookingCount: bundle.bookingCount,
        analyticsEventCount: bundle.analyticsEventCount,
        channel: bundle.channel,
      });
      if (signalCount < parsed.minEventCount) continue;
      const document = mapPerformanceToMemoryDocument(
        {
          productId: bundle.productId,
          productTitle: bundle.productTitle,
          channel: bundle.channel,
          window,
          publicationCount: bundle.publicationCount,
          threadPostCount: bundle.threadPostCount,
          inquiryCount: bundle.inquiryCount,
          bookingCount: bundle.bookingCount,
          analyticsEventCount: bundle.analyticsEventCount,
          feedback: bundle.feedback,
          publicationContentIds: bundle.publicationContentIds,
          contentTitles: bundle.contentTitles,
        },
        parsed.now,
      );
      if (document) documents.push(document);
    }
    return documents;
  }

  private async loadBundles(
    parsed: ParsedPerformanceMemoryLoadParams,
  ): Promise<PerformanceMemoryBundle[]> {
    if (this.deps.loadBundles) return this.deps.loadBundles(parsed);
    const { loadPerformanceMemoryBundles } = await import("@/lib/marketing/memory/performanceMemoryLoad");
    return loadPerformanceMemoryBundles(parsed);
  }
}

export function createPerformanceMemorySource(
  deps: PerformanceMemorySourceDeps = {},
): PerformanceMemorySource {
  return new PerformanceMemorySource(deps);
}
