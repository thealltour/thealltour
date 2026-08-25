import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import type { ContentHistoryItem } from "@/lib/marketing/context/types";
import { MAX_LOOKBACK_DAYS, isUuid, requireUuid, resolvePeriod } from "@/lib/marketing/context/validation";
import {
  CONTENT_MEMORY_DEFAULT_LIMIT,
  CONTENT_MEMORY_DEFAULT_LOOKBACK_DAYS,
  CONTENT_MEMORY_MAX_LIMIT,
  CONTENT_MEMORY_SOURCE_NAME,
} from "@/lib/marketing/memory/constants";
import { mapContentToMemoryDocument } from "@/lib/marketing/memory/contentMemoryContent";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";

export const CONTENT_MEMORY_LEGACY_SOURCE_TYPES = [
  "notice",
  "guide",
  "flyer_draft",
  "home_hero_content",
  "home_banner",
  "mobile_golf_ad_landing",
] as const;

export const CONTENT_MEMORY_FILTER_SOURCE_TYPES = [
  "ai_content",
  ...CONTENT_MEMORY_LEGACY_SOURCE_TYPES,
] as const;

export type ContentMemoryFilterSourceType = (typeof CONTENT_MEMORY_FILTER_SOURCE_TYPES)[number];

export type ContentMemoryLoadParams = {
  contentId?: string;
  contentIds?: string[];
  productId?: string;
  productIds?: string[];
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
  sourceType?: string;
  limit?: number;
  now?: Date;
};

export type ParsedContentMemoryLoadParams = {
  contentIds: string[];
  productIds: string[];
  channel: string | null;
  sourceType: ContentMemoryFilterSourceType | null;
  limit: number;
  lookbackDays: number;
  applyPeriod: boolean;
  explicitRange: boolean;
  period: { start: string; end: string };
  now: Date;
};

export type ContentMemoryBundle = {
  history: ContentHistoryItem;
  channels: string[];
  publishedAt: string | null;
  productTitle: string | null;
  campaignName: string | null;
  agendaTopic: string | null;
  agendaKey: string | null;
  hook: string | null;
  cta: string | null;
};

export type ContentMemorySourceDeps = {
  loadBundles?: (params: ParsedContentMemoryLoadParams) => Promise<ContentMemoryBundle[]>;
};

function pushUuid(ids: string[], seen: Set<string>, value: string, field: string) {
  const id = requireUuid(value, field);
  if (seen.has(id)) return;
  seen.add(id);
  ids.push(id);
}

export function parseContentMemoryLoadParams(params: ContentMemoryLoadParams = {}): ParsedContentMemoryLoadParams {
  const limit = params.limit ?? CONTENT_MEMORY_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > CONTENT_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`limit must be an integer between 1 and ${CONTENT_MEMORY_MAX_LIMIT}`);
  }
  const lookbackDays = params.lookbackDays ?? CONTENT_MEMORY_DEFAULT_LOOKBACK_DAYS;
  if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > MAX_LOOKBACK_DAYS) {
    throw new MemoryValidationError(`lookbackDays must be an integer between 1 and ${MAX_LOOKBACK_DAYS}`);
  }

  const contentIds: string[] = [];
  const contentSeen = new Set<string>();
  if (params.contentId) pushUuid(contentIds, contentSeen, params.contentId, "contentId");
  for (const value of params.contentIds ?? []) {
    if (typeof value !== "string" || !isUuid(value)) {
      throw new ContextValidationError("contentIds must be UUIDs");
    }
    pushUuid(contentIds, contentSeen, value, "contentIds");
  }

  const productIds: string[] = [];
  const productSeen = new Set<string>();
  if (params.productId) pushUuid(productIds, productSeen, params.productId, "productId");
  for (const value of params.productIds ?? []) {
    if (typeof value !== "string" || !isUuid(value)) {
      throw new ContextValidationError("productIds must be UUIDs");
    }
    pushUuid(productIds, productSeen, value, "productIds");
  }

  if (contentIds.length === 0 && productIds.length === 0) {
    throw new MemoryValidationError("contentId or productId is required");
  }
  if (contentIds.length > CONTENT_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`contentIds exceed CONTENT_MEMORY_MAX_LIMIT (${CONTENT_MEMORY_MAX_LIMIT})`);
  }
  if (productIds.length > CONTENT_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`productIds exceed CONTENT_MEMORY_MAX_LIMIT (${CONTENT_MEMORY_MAX_LIMIT})`);
  }

  const sourceTypeRaw = params.sourceType?.trim().toLowerCase() ?? "";
  let sourceType: ContentMemoryFilterSourceType | null = null;
  if (sourceTypeRaw) {
    if (!(CONTENT_MEMORY_FILTER_SOURCE_TYPES as readonly string[]).includes(sourceTypeRaw)) {
      throw new MemoryValidationError(`unsupported sourceType: ${params.sourceType}`);
    }
    sourceType = sourceTypeRaw as ContentMemoryFilterSourceType;
  }

  const channel = params.channel?.trim().toLowerCase() || null;
  const explicitRange = Boolean(params.periodStart?.trim()) || Boolean(params.periodEnd?.trim());
  const applyPeriod = contentIds.length === 0 || explicitRange || params.lookbackDays != null;
  const now = params.now ?? new Date();
  const period = resolvePeriod({
    lookbackDays: explicitRange ? undefined : lookbackDays,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    now,
  });

  return {
    contentIds,
    productIds,
    channel,
    sourceType,
    limit,
    lookbackDays,
    applyPeriod,
    explicitRange,
    period,
    now,
  };
}

export class ContentMemorySource implements MemoryIngestionSource<ContentMemoryLoadParams> {
  readonly name = CONTENT_MEMORY_SOURCE_NAME;

  constructor(private readonly deps: ContentMemorySourceDeps = {}) {}

  async load(params: ContentMemoryLoadParams = {}): Promise<MemoryDocument[]> {
    const parsed = parseContentMemoryLoadParams(params);
    const bundles = await this.loadBundles(parsed);
    const documents: MemoryDocument[] = [];
    for (const bundle of bundles.slice(0, parsed.limit)) {
      const document = mapContentToMemoryDocument(bundle, parsed.now);
      if (document) documents.push(document);
    }
    return documents;
  }

  private async loadBundles(parsed: ParsedContentMemoryLoadParams): Promise<ContentMemoryBundle[]> {
    if (this.deps.loadBundles) return this.deps.loadBundles(parsed);
    const { loadContentMemoryBundles } = await import("@/lib/marketing/memory/contentMemoryLoad");
    return loadContentMemoryBundles(parsed);
  }
}

export function createContentMemorySource(deps: ContentMemorySourceDeps = {}): ContentMemorySource {
  return new ContentMemorySource(deps);
}
