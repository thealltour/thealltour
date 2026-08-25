import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import { aggregateCustomerInsights } from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import type { InquiryInsightContext } from "@/lib/marketing/context/types";
import { MAX_LOOKBACK_DAYS, isUuid, requireUuid, resolvePeriod } from "@/lib/marketing/context/validation";
import {
  CUSTOMER_INSIGHT_DEFAULT_LIMIT,
  CUSTOMER_INSIGHT_DEFAULT_LOOKBACK_DAYS,
  CUSTOMER_INSIGHT_DEFAULT_MIN_INQUIRY_COUNT,
  CUSTOMER_INSIGHT_MAX_LIMIT,
  CUSTOMER_INSIGHT_SOURCE_NAME,
} from "@/lib/marketing/memory/constants";
import {
  customerInsightWindowKey,
  mapCustomerInsightToMemoryDocument,
} from "@/lib/marketing/memory/customerInsightMemoryContent";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";

export type CustomerInsightMemoryLoadParams = {
  productId?: string;
  productIds?: string[];
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  minInquiryCount?: number;
  now?: Date;
};

export type ParsedCustomerInsightMemoryLoadParams = {
  ids: string[];
  limit: number;
  minInquiryCount: number;
  lookbackDays: number;
  explicitRange: boolean;
  period: { start: string; end: string };
  windowKey: string;
  now: Date;
};

export type CustomerInsightMemoryBundle = {
  productId: string;
  productTitle: string | null;
  inquiries: InquiryInsightContext[];
};

export type CustomerInsightMemorySourceDeps = {
  loadBundles?: (params: ParsedCustomerInsightMemoryLoadParams) => Promise<CustomerInsightMemoryBundle[]>;
};

export function parseCustomerInsightMemoryLoadParams(
  params: CustomerInsightMemoryLoadParams = {},
): ParsedCustomerInsightMemoryLoadParams {
  const limit = params.limit ?? CUSTOMER_INSIGHT_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > CUSTOMER_INSIGHT_MAX_LIMIT) {
    throw new MemoryValidationError(`limit must be an integer between 1 and ${CUSTOMER_INSIGHT_MAX_LIMIT}`);
  }
  const minInquiryCount = params.minInquiryCount ?? CUSTOMER_INSIGHT_DEFAULT_MIN_INQUIRY_COUNT;
  if (!Number.isInteger(minInquiryCount) || minInquiryCount < 0) {
    throw new MemoryValidationError("minInquiryCount must be a non-negative integer");
  }
  const lookbackDays = params.lookbackDays ?? CUSTOMER_INSIGHT_DEFAULT_LOOKBACK_DAYS;
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
  if (ids.length > CUSTOMER_INSIGHT_MAX_LIMIT) {
    throw new MemoryValidationError(`productIds exceed CUSTOMER_INSIGHT_MAX_LIMIT (${CUSTOMER_INSIGHT_MAX_LIMIT})`);
  }

  const explicitRange = Boolean(params.periodStart?.trim()) || Boolean(params.periodEnd?.trim());
  const now = params.now ?? new Date();
  const period = resolvePeriod({
    lookbackDays: explicitRange ? undefined : lookbackDays,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    now,
  });
  const windowKey = customerInsightWindowKey({
    lookbackDays,
    explicitRange,
    periodStart: period.start,
    periodEnd: period.end,
  });

  return {
    ids,
    limit,
    minInquiryCount,
    lookbackDays,
    explicitRange,
    period,
    windowKey,
    now,
  };
}

export class CustomerInsightMemorySource implements MemoryIngestionSource<CustomerInsightMemoryLoadParams> {
  readonly name = CUSTOMER_INSIGHT_SOURCE_NAME;

  constructor(private readonly deps: CustomerInsightMemorySourceDeps = {}) {}

  async load(params: CustomerInsightMemoryLoadParams = {}): Promise<MemoryDocument[]> {
    const parsed = parseCustomerInsightMemoryLoadParams(params);
    const bundles = await this.loadBundles(parsed);
    const window = {
      key: parsed.windowKey,
      lookbackDays: parsed.lookbackDays,
      explicitRange: parsed.explicitRange,
      period: parsed.period,
    };
    const documents: MemoryDocument[] = [];
    for (const bundle of bundles.slice(0, parsed.limit)) {
      const insight = aggregateCustomerInsights({
        topic: "voice_of_customer",
        productId: bundle.productId,
        period: parsed.period,
        inquiries: bundle.inquiries,
      });
      if (insight.inquiryCount < parsed.minInquiryCount) continue;
      const document = mapCustomerInsightToMemoryDocument(
        {
          productId: bundle.productId,
          productTitle: bundle.productTitle,
          window,
          inquiries: bundle.inquiries,
          insight,
        },
        parsed.now,
      );
      if (document) documents.push(document);
    }
    return documents;
  }

  private async loadBundles(
    parsed: ParsedCustomerInsightMemoryLoadParams,
  ): Promise<CustomerInsightMemoryBundle[]> {
    if (this.deps.loadBundles) return this.deps.loadBundles(parsed);
    const { loadCustomerInsightMemoryBundles } = await import(
      "@/lib/marketing/memory/customerInsightMemoryLoad"
    );
    return loadCustomerInsightMemoryBundles(parsed);
  }
}

export function createCustomerInsightMemorySource(
  deps: CustomerInsightMemorySourceDeps = {},
): CustomerInsightMemorySource {
  return new CustomerInsightMemorySource(deps);
}
